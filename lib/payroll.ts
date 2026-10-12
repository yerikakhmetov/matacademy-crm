import { prisma } from "./prisma";
import { settledRatio } from "./payments.ts";
import {
  computeCuratorRows,
  computePayrollRows,
  feeKey,
  isPayableAttendance,
  payableKey,
  scheduledLessonsInMonth,
  type CuratorRow,
  type PayrollCurator,
  type PayrollRow,
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

// Месячная доля ученика по предмету: feeKey(studentId, subjectId) -> ₸.
// Источник — абонемент, действующий в месяце; для учеников без абонемента —
// оплаты с разбивкой по предметам, датированные этим месяцем.
// Загружается один раз на весь диапазон и раздаётся по месяцам функцией.
async function loadMonthlyFees(studentIds: string[], rangeStart: Date, rangeEnd: Date) {
  const [subs, payItems] = studentIds.length
    ? await Promise.all([
        prisma.subscription.findMany({
          where: {
            studentId: { in: studentIds },
            startDate: { lt: rangeEnd },
            OR: [{ endDate: null }, { endDate: { gte: rangeStart } }],
          },
          select: { studentId: true, months: true, startDate: true, endDate: true, items: { select: { subjectId: true, amount: true } } },
        }),
        prisma.paymentItem.findMany({
          where: {
            subjectId: { not: null },
            payment: { paidAmount: { gt: 0 }, studentId: { in: studentIds }, date: { gte: rangeStart, lt: rangeEnd } },
          },
          select: {
            subjectId: true,
            amount: true,
            payment: { select: { studentId: true, date: true, amount: true, paidAmount: true, refundedAmount: true } },
          },
        }),
      ])
    : [[], []];

  const paidFeeByMonth = new Map<string, Map<string, number>>();
  for (const it of payItems) {
    if (!it.subjectId) continue;
    const mk = utcKey(it.payment.date);
    let m = paidFeeByMonth.get(mk);
    if (!m) paidFeeByMonth.set(mk, (m = new Map()));
    const k = feeKey(it.payment.studentId, it.subjectId);
    // Частично оплаченный счёт даёт предмету только оплаченную долю
    const ratio = settledRatio(it.payment.amount, it.payment.paidAmount, it.payment.refundedAmount);
    m.set(k, (m.get(k) ?? 0) + it.amount * ratio);
  }

  return (year: number, month0: number): Map<string, number> => {
    const monthStart = new Date(Date.UTC(year, month0, 1));
    const monthEnd = new Date(Date.UTC(year, month0 + 1, 1));
    const monthlyFee = new Map<string, number>();
    for (const sub of subs) {
      const covers = sub.startDate < monthEnd && (sub.endDate === null || sub.endDate >= monthStart);
      if (!covers) continue;
      const mm = Math.max(1, sub.months);
      for (const it of sub.items) {
        if (!it.subjectId) continue;
        const k = feeKey(sub.studentId, it.subjectId);
        monthlyFee.set(k, (monthlyFee.get(k) ?? 0) + it.amount / mm);
      }
    }
    const paidFee = paidFeeByMonth.get(mKey(year, month0));
    if (paidFee) for (const [k, v] of paidFee) if (!monthlyFee.has(k)) monthlyFee.set(k, v);
    return monthlyFee;
  };
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
          lessons: { where: { archivedAt: null }, select: { id: true, dayOfWeek: true } },
        },
      },
    },
  });

  const lessonToGroup = new Map<string, string>();
  const studentIds = new Set<string>();
  for (const t of teachersDb) {
    for (const g of t.groups) {
      for (const l of g.lessons) lessonToGroup.set(l.id, g.id);
      for (const s of g.students) studentIds.add(s.id);
    }
  }
  const allLessonIds = [...lessonToGroup.keys()];
  const ids = [...studentIds];

  const [att, feesFor, cancelled] = await Promise.all([
    allLessonIds.length
      ? prisma.attendance.findMany({
          where: { lessonId: { in: allLessonIds }, date: { gte: rangeStart, lt: rangeEnd } },
          select: { lessonId: true, studentId: true, present: true, excused: true, date: true },
        })
      : Promise.resolve([]),
    loadMonthlyFees(ids, rangeStart, rangeEnd),
    // Отменённые занятия не входят в делитель — кроме сорванных по вине
    // преподавателя: такой день остаётся в делителе, и за него не платят.
    allLessonIds.length
      ? prisma.lessonSession.findMany({
          where: {
            lessonId: { in: allLessonIds },
            cancelled: true,
            date: { gte: rangeStart, lt: rangeEnd },
            // явный OR: у старых отмен cancelFault = NULL, и они должны попадать в выборку
            OR: [{ cancelFault: null }, { cancelFault: { not: "TEACHER" } }],
          },
          select: { lessonId: true, date: true },
        })
      : Promise.resolve([]),
  ]);

  // Разложить всё по месяцам один раз
  const payableByMonth = new Map<string, Map<string, number>>();
  for (const a of att) {
    const gid = lessonToGroup.get(a.lessonId);
    if (!gid) continue;
    if (!isPayableAttendance(a.present, a.excused)) continue;
    const mk = utcKey(a.date);
    let m = payableByMonth.get(mk);
    if (!m) payableByMonth.set(mk, (m = new Map()));
    const k = payableKey(gid, a.studentId);
    m.set(k, (m.get(k) ?? 0) + 1);
  }

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
          scheduledLessonsInMonth(year, month0, g.lessons.map((l) => l.dayOfWeek), g.startDate) -
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

// Зарплата кураторов за несколько месяцев: ставка × число оплативших
// ученико-предметов в группах куратора. Арифметика — computeCuratorRows.
export async function gatherCuratorPayrollRange(months: Month[], defaultRate: number): Promise<Map<string, CuratorRow>[]> {
  if (months.length === 0) return [];
  const { rangeStart, rangeEnd } = monthRange(months);

  const [groups, subjectRows] = await Promise.all([
    prisma.group.findMany({
      where: { curatorId: { not: null } },
      select: { id: true, curatorId: true, subjectId: true, students: { select: { id: true } } },
    }),
    prisma.subject.findMany({ where: { curatorRate: { gt: 0 } }, select: { id: true, curatorRate: true } }),
  ]);
  const subjectRates = new Map(subjectRows.map((s) => [s.id, s.curatorRate]));

  const byCurator = new Map<string, PayrollCurator>();
  const studentIds = new Set<string>();
  for (const g of groups) {
    if (!g.curatorId) continue;
    let c = byCurator.get(g.curatorId);
    if (!c) byCurator.set(g.curatorId, (c = { id: g.curatorId, groups: [] }));
    c.groups.push({ id: g.id, subjectId: g.subjectId, studentIds: g.students.map((s) => s.id) });
    for (const s of g.students) studentIds.add(s.id);
  }
  const curators = [...byCurator.values()];
  const feesFor = await loadMonthlyFees([...studentIds], rangeStart, rangeEnd);

  return months.map(({ year, month0 }) =>
    computeCuratorRows({ curators, monthlyFee: feesFor(year, month0), defaultRate, subjectRates })
  );
}

export async function gatherCuratorPayroll(year: number, month0: number, defaultRate: number): Promise<Map<string, CuratorRow>> {
  const [rows] = await gatherCuratorPayrollRange([{ year, month0 }], defaultRate);
  return rows ?? new Map();
}
