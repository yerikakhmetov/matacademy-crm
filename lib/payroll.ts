import { prisma } from "./prisma";
import { settledRatio } from "./payments.ts";
import {
  computeCuratorRows,
  computePayrollRows,
  isPayableAttendance,
  monthlyFeesFromPaid,
  payableKey,
  slotLessonsInMonth,
  type CuratorRow,
  type PayrollCurator,
  type PayrollRow,
  type PaidItem,
  type PayrollTeacher,
  type SubjectRate,
} from "./payroll-calc.ts";

// Сбор данных из БД для расчёта зарплаты. Сама арифметика — в ./payroll-calc.ts (покрыта тестами).
export * from "./payroll-calc.ts";

export type Month = { year: number; month0: number };

const mKey = (year: number, month0: number) => `${year}-${month0}`;
const utcKey = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}`;

const monthRange = (months: Month[]) => {
  const sorted = [...months].sort((a, b) => a.year - b.year || a.month0 - b.month0);
  const last = sorted[sorted.length - 1];
  return {
    rangeStart: new Date(Date.UTC(sorted[0].year, sorted[0].month0, 1)),
    rangeEnd: new Date(Date.UTC(last.year, last.month0 + 1, 1)),
  };
};

// Самый длинный счёт, который может «дотянуться» до месяца расчёта из прошлого.
const MAX_INVOICE_MONTHS = 12;

// Месячная доля ученика по предмету: feeKey(studentId, subjectId) -> ₸.
// Источник — ТОЛЬКО оплаченные счета с разбивкой по предметам: неоплаченный счёт
// зарплату не приносит, частично оплаченный — пропорционально, счёт на N месяцев
// делится поровну между ними. Загружается один раз на диапазон, раздаётся по месяцам.
async function loadMonthlyFees(studentIds: string[], rangeStart: Date, rangeEnd: Date) {
  const lookBack = new Date(Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth() - (MAX_INVOICE_MONTHS - 1), 1));
  const payItems = studentIds.length
    ? await prisma.paymentItem.findMany({
        where: {
          subjectId: { not: null },
          payment: { paidAmount: { gt: 0 }, studentId: { in: studentIds }, date: { gte: lookBack, lt: rangeEnd } },
        },
        select: {
          subjectId: true,
          amount: true,
          payment: { select: { studentId: true, date: true, months: true, amount: true, paidAmount: true, refundedAmount: true } },
        },
      })
    : [];

  const items: PaidItem[] = payItems
    .filter((it) => it.subjectId)
    .map((it) => ({
      studentId: it.payment.studentId,
      subjectId: it.subjectId!,
      amount: it.amount,
      ratio: settledRatio(it.payment.amount, it.payment.paidAmount, it.payment.refundedAmount),
      year: it.payment.date.getUTCFullYear(),
      month0: it.payment.date.getUTCMonth(),
      months: it.payment.months,
    }));

  return (year: number, month0: number) => monthlyFeesFromPaid(items, year, month0);
}

// Оплачиваемые посещения по месяцам: monthKey -> payableKey(groupId, studentId) -> число.
async function loadPayableByMonth(lessonToGroup: Map<string, string>, rangeStart: Date, rangeEnd: Date) {
  const lessonIds = [...lessonToGroup.keys()];
  const att = lessonIds.length
    ? await prisma.attendance.findMany({
        where: { lessonId: { in: lessonIds }, date: { gte: rangeStart, lt: rangeEnd } },
        select: { lessonId: true, studentId: true, present: true, excused: true, date: true },
      })
    : [];
  const byMonth = new Map<string, Map<string, number>>();
  for (const a of att) {
    const gid = lessonToGroup.get(a.lessonId);
    if (!gid || !isPayableAttendance(a.present, a.excused)) continue;
    const mk = utcKey(a.date);
    let m = byMonth.get(mk);
    if (!m) byMonth.set(mk, (m = new Map()));
    const k = payableKey(gid, a.studentId);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return byMonth;
}

// Зарплата всех преподавателей сразу за несколько месяцев.
// Все запросы идут один раз на весь диапазон: страницы «Отчёты» и «Моя зарплата»
// показывают 6 месяцев, и по запросу на каждый месяц база сканировалась шесть раз.
export async function gatherPayrollRange(months: Month[], feePct: number): Promise<Map<string, PayrollRow>[]> {
  if (months.length === 0) return [];

  const { rangeStart, rangeEnd } = monthRange(months);

  // Ставки по предметам: если задана, зарплата считается по ней
  const subjectRows = await prisma.subject.findMany({
    where: { teacherRate: { gt: 0 } },
    select: { id: true, teacherRate: true, teacherRateLessons: true },
  });
  const rates = new Map<string, SubjectRate>(
    subjectRows.map((s) => [s.id, { amount: s.teacherRate, lessons: Math.max(1, s.teacherRateLessons) }])
  );

  const teachersDb = await prisma.teacher.findMany({
    select: {
      id: true,
      groups: {
        select: {
          id: true,
          subjectId: true,
          startDate: true,
          students: { select: { id: true } },
          // архивные слоты тоже: по ним остаются отметки прошлых месяцев
          lessons: { select: { id: true, dayOfWeek: true, activeFrom: true, archivedAt: true } },
        },
      },
    },
  });

  const lessonToGroup = new Map<string, string>();
  const studentIds = new Set<string>();
  for (const t of teachersDb) {
    for (const g of t.groups) {
      for (const l of g.lessons) {
        lessonToGroup.set(l.id, g.id);
      }
      for (const s of g.students) studentIds.add(s.id);
    }
  }

  const [payableByMonth, cancelled] = await Promise.all([
    loadPayableByMonth(lessonToGroup, rangeStart, rangeEnd),
    // Отменённые занятия не входят в делитель — кроме сорванных по вине
    // преподавателя: такой день остаётся в делителе, и за него не платят.
    // архивные слоты тоже: их отмены относятся к месяцам, когда они ещё шли
    lessonToGroup.size
      ? prisma.lessonSession.findMany({
          where: {
            lessonId: { in: [...lessonToGroup.keys()] },
            cancelled: true,
            date: { gte: rangeStart, lt: rangeEnd },
            // явный OR: у старых отмен cancelFault = NULL, и они должны попадать в выборку
            OR: [{ cancelFault: null }, { cancelFault: { not: "TEACHER" } }],
          },
          select: { lessonId: true, date: true },
        })
      : Promise.resolve([]),
  ]);
  // Доли нужны и тем, кто ходил в этом месяце, но уже вышел из группы
  for (const m of payableByMonth.values()) for (const k of m.keys()) studentIds.add(k.split("|")[1]);
  const feesFor = await loadMonthlyFees([...studentIds], rangeStart, rangeEnd);

  const cancelledByMonth = new Map<string, Map<string, number>>();
  for (const c of cancelled) {
    const gid = lessonToGroup.get(c.lessonId);
    if (!gid) continue;
    const mk = utcKey(c.date);
    let m = cancelledByMonth.get(mk);
    if (!m) cancelledByMonth.set(mk, (m = new Map()));
    m.set(gid, (m.get(gid) ?? 0) + 1);
  }

  return months.map(({ year, month0 }) => {
    const mk = mKey(year, month0);
    const monthlyFee = feesFor(year, month0);

    const cancelledByGroup = cancelledByMonth.get(mk) ?? new Map<string, number>();
    const teachers: PayrollTeacher[] = teachersDb.map((t) => ({
      id: t.id,
      groups: t.groups.map((g) => ({
        id: g.id,
        subjectId: g.subjectId,
        scheduledLessons: Math.max(
          0,
          slotLessonsInMonth(year, month0, g.lessons, g.startDate) -
            (cancelledByGroup.get(g.id) ?? 0)
        ),
        studentIds: g.students.map((s) => s.id),
      })),
    }));

    return computePayrollRows({
      teachers,
      payable: payableByMonth.get(mk) ?? new Map(),
      monthlyFee,
      rates,
      feePct,
    });
  });
}

// Месячная зарплата всех преподавателей за (year, month0). feePct — удержание школы, %.
export async function gatherPayroll(year: number, month0: number, feePct: number): Promise<Map<string, PayrollRow>> {
  const [rows] = await gatherPayrollRange([{ year, month0 }], feePct);
  return rows ?? new Map();
}

// Зарплата кураторов за несколько месяцев: ставка × оплатившие ученико-предметы
// в группах куратора; ученик в нескольких группах предмета делится по занятиям.
// Арифметика — computeCuratorRows.
export async function gatherCuratorPayrollRange(months: Month[], defaultRate: number): Promise<Map<string, CuratorRow>[]> {
  if (months.length === 0) return [];
  const { rangeStart, rangeEnd } = monthRange(months);

  const [groups, subjectRows] = await Promise.all([
    // все группы с предметом: ставку делят и группы без куратора
    prisma.group.findMany({
      where: { subjectId: { not: null } },
      select: {
        id: true,
        curatorId: true,
        subjectId: true,
        curatorRate: true,
        students: { select: { id: true } },
        lessons: { select: { id: true } },
      },
    }),
    prisma.subject.findMany({ where: { curatorRate: { gt: 0 } }, select: { id: true, curatorRate: true } }),
  ]);
  const subjectRates = new Map(subjectRows.map((s) => [s.id, s.curatorRate]));

  const byCurator = new Map<string, PayrollCurator>();
  const curatedGroupIds = new Set<string>();
  const studentIds = new Set<string>();
  const lessonToGroup = new Map<string, string>();
  for (const g of groups) {
    for (const l of g.lessons) lessonToGroup.set(l.id, g.id);
    if (!g.curatorId) continue;
    curatedGroupIds.add(g.id);
    let c = byCurator.get(g.curatorId);
    if (!c) byCurator.set(g.curatorId, (c = { id: g.curatorId, groups: [] }));
    c.groups.push({ id: g.id, subjectId: g.subjectId, studentIds: g.students.map((s) => s.id), rate: g.curatorRate });
    for (const s of g.students) studentIds.add(s.id);
  }
  const curators = [...byCurator.values()];
  if (curators.length === 0) return months.map(() => new Map());

  const payableByMonth = await loadPayableByMonth(lessonToGroup, rangeStart, rangeEnd);
  for (const m of payableByMonth.values()) {
    for (const k of m.keys()) {
      const [gid, sid] = k.split("|");
      if (curatedGroupIds.has(gid)) studentIds.add(sid);
    }
  }
  const feesFor = await loadMonthlyFees([...studentIds], rangeStart, rangeEnd);
  const allGroups = groups.map((g) => ({ id: g.id, subjectId: g.subjectId }));

  return months.map(({ year, month0 }) =>
    computeCuratorRows({
      curators,
      monthlyFee: feesFor(year, month0),
      defaultRate,
      subjectRates,
      payable: payableByMonth.get(mKey(year, month0)) ?? new Map(),
      allGroups,
    })
  );
}

export async function gatherCuratorPayroll(year: number, month0: number, defaultRate: number): Promise<Map<string, CuratorRow>> {
  const [rows] = await gatherCuratorPayrollRange([{ year, month0 }], defaultRate);
  return rows ?? new Map();
}
