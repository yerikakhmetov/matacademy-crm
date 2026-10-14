import { cache } from "react";
import { prisma } from "./prisma";
import { settledRatio } from "./payments.ts";
import {
  computeCuratorRows,
  feeKey,
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
  type PackagedPay,
} from "./payroll-calc.ts";
import { PACKAGE_BILLING_FROM, allocateVisits, creditFromItem, lessonsLeft, leftKey, packageBillingStart, prepaidBySubject, type Credit, type LessonsLeft, type Visit } from "./packages.ts";

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

// Месяц считается по пакетам занятий (а не «доля ÷ занятий месяца»)?
const isPackagedMonth = (year: number, month0: number) =>
  year * 12 + month0 >= PACKAGE_BILLING_FROM.year * 12 + PACKAGE_BILLING_FROM.month0;

// Пакеты занятий: оплачиваемые посещения с начала пакетов списываются с оплаченных
// занятий по счетам (lib/packages.ts). Результат по месяцам:
// monthKey -> payableKey(groupId, studentId) -> { сумма цен списанных занятий, сколько покрыто }.
async function loadPackagedByMonth(
  groups: { id: string; subjectId: string | null; lessonIds: string[] }[],
  rangeEnd: Date
): Promise<Map<string, Map<string, PackagedPay>>> {
  const from = packageBillingStart();
  const out = new Map<string, Map<string, PackagedPay>>();
  if (rangeEnd <= from) return out;
  const lessonInfo = new Map<string, { groupId: string; subjectId: string }>();
  for (const g of groups) if (g.subjectId) for (const l of g.lessonIds) lessonInfo.set(l, { groupId: g.id, subjectId: g.subjectId });
  if (lessonInfo.size === 0) return out;

  // все оплачиваемые посещения с начала пакетов: остаток пакета зависит от всей истории
  const att = await prisma.attendance.findMany({
    where: { lessonId: { in: [...lessonInfo.keys()] }, date: { gte: from, lt: rangeEnd } },
    select: { lessonId: true, studentId: true, present: true, excused: true, date: true },
  });
  const visits: Visit[] = [];
  for (const a of att) {
    const li = lessonInfo.get(a.lessonId);
    if (!li || !isPayableAttendance(a.present, a.excused)) continue;
    visits.push({ studentId: a.studentId, subjectId: li.subjectId, groupId: li.groupId, date: a.date });
  }
  if (visits.length === 0) return out;

  const credits = await loadCredits([...new Set(visits.map((v) => v.studentId))]);
  for (const a of allocateVisits(credits, visits)) {
    if (a.date >= rangeEnd) continue;
    const mk = utcKey(a.date);
    let m = out.get(mk);
    if (!m) out.set(mk, (m = new Map()));
    const k = payableKey(a.groupId, a.studentId);
    const cur = m.get(k) ?? { value: 0, covered: 0 };
    if (a.paymentId) {
      cur.value += a.value;
      cur.covered += 1;
    }
    m.set(k, cur);
  }
  return out;
}

// Оплаченные занятия учеников по всем их счетам с разбивкой по предметам.
// Старые календарные счета дают занятия только за свои месяцы с начала пакетов:
// более ранние месяцы уже оплачены по старым правилам.
export async function loadCredits(studentIds: string[]): Promise<Credit[]> {
  if (studentIds.length === 0) return [];
  const startIdx = PACKAGE_BILLING_FROM.year * 12 + PACKAGE_BILLING_FROM.month0;
  const items = await prisma.paymentItem.findMany({
    where: { subjectId: { not: null }, payment: { paidAmount: { gt: 0 }, studentId: { in: studentIds } } },
    select: {
      subjectId: true,
      amount: true,
      lessonsPerMonth: true,
      subject: { select: { lessonsPerMonth: true } },
      payment: {
        select: { id: true, studentId: true, date: true, months: true, studyMonth: true, amount: true, paidAmount: true, refundedAmount: true },
      },
    },
  });
  const credits: Credit[] = [];
  for (const it of items) {
    const p = it.payment;
    const idx = p.date.getUTCFullYear() * 12 + p.date.getUTCMonth();
    const c = creditFromItem({
      paymentId: p.id,
      studentId: p.studentId,
      subjectId: it.subjectId!,
      itemAmount: it.amount,
      months: p.months,
      // снимок на момент счёта; у старых строк без снимка — текущее значение предмета
      lessonsPerMonth: it.lessonsPerMonth ?? it.subject?.lessonsPerMonth ?? 0,
      ratio: settledRatio(p.amount, p.paidAmount, p.refundedAmount),
      order: p.date.getTime(),
      // Месяцы до начала пакетов уже оплачены по старым правилам. Для новых счетов (дата
      // не раньше октября) это 0; номер месяца, вписанный в старый счёт, не даёт ему лишних занятий.
      skipMonths: Math.max(0, startIdx - idx),
    });
    if (c) credits.push(c);
  }
  return credits;
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

  // Пакеты считаются по всем группам с предметом: посещения в группе без
  // преподавателя тоже списывают занятия из пакета ученика
  const packagedByMonth = months.some((m) => isPackagedMonth(m.year, m.month0))
    ? await packagedUntil(rangeEnd.getTime())
    : new Map<string, Map<string, PackagedPay>>();

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
      packaged: isPackagedMonth(year, month0) ? (packagedByMonth.get(mk) ?? new Map()) : undefined,
    });
  });
}

// Пакеты считаются по всей истории с начала пакетов — это самая тяжёлая часть расчёта.
// Страницы «Зарплата» и «Моя зарплата» считают и преподавателей, и кураторов: в одном
// запросе к серверу результат берётся один раз (cache из React живёт в пределах запроса).
const packagedUntil = cache(async (rangeEndMs: number) =>
  loadPackagedByMonth(await allSubjectGroups(), new Date(rangeEndMs))
);

async function allSubjectGroups() {
  const gs = await prisma.group.findMany({
    where: { subjectId: { not: null } },
    select: { id: true, subjectId: true, lessons: { select: { id: true } } },
  });
  return gs.map((g) => ({ id: g.id, subjectId: g.subjectId, lessonIds: g.lessons.map((l) => l.id) }));
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

  const packagedByMonth = months.some((m) => isPackagedMonth(m.year, m.month0))
    ? await packagedUntil(rangeEnd.getTime())
    : new Map<string, Map<string, PackagedPay>>();
  const subjectOf = new Map(groups.map((g) => [g.id, g.subjectId]));

  return months.map(({ year, month0 }) => {
    if (!isPackagedMonth(year, month0)) {
      return computeCuratorRows({
        curators,
        monthlyFee: feesFor(year, month0),
        defaultRate,
        subjectRates,
        payable: payableByMonth.get(mKey(year, month0)) ?? new Map(),
        allGroups,
      });
    }
    // Пакеты: ученик «оплатил» месяц в группе, если хоть одно его посещение в ней
    // в этом месяце покрыто оплаченным занятием; ставка делится по покрытым занятиям.
    const covered = new Map<string, number>();
    const paidMarker = new Map<string, number>();
    for (const [k, p] of packagedByMonth.get(mKey(year, month0)) ?? new Map<string, PackagedPay>()) {
      if (p.covered <= 0) continue;
      covered.set(k, p.covered);
      const [gid, sid] = k.split("|");
      const subj = subjectOf.get(gid);
      if (subj) paidMarker.set(feeKey(sid, subj), 1);
    }
    return computeCuratorRows({ curators, monthlyFee: paidMarker, defaultRate, subjectRates, payable: covered, allGroups });
  });
}

export async function gatherCuratorPayroll(year: number, month0: number, defaultRate: number): Promise<Map<string, CuratorRow>> {
  const [rows] = await gatherCuratorPayrollRange([{ year, month0 }], defaultRate);
  return rows ?? new Map();
}

// Остаток оплаченных занятий по предмету у учеников (для страницы группы и портала):
// studentId -> { left, total, unpaid }. Посещения считаются во всех группах предмета.
export async function lessonsLeftBySubject(studentIds: string[], subjectId: string): Promise<Map<string, LessonsLeft>> {
  const out = new Map<string, LessonsLeft>();
  if (studentIds.length === 0) return out;
  const [credits, att] = await Promise.all([
    loadCredits(studentIds),
    prisma.attendance.findMany({
      where: { studentId: { in: studentIds }, date: { gte: packageBillingStart() }, lesson: { group: { subjectId } } },
      select: { studentId: true, present: true, excused: true, date: true, lesson: { select: { groupId: true } } },
    }),
  ]);
  const visits: Visit[] = att
    .filter((a) => isPayableAttendance(a.present, a.excused))
    .map((a) => ({ studentId: a.studentId, subjectId, groupId: a.lesson.groupId, date: a.date }));
  const left = lessonsLeft(credits.filter((c) => c.subjectId === subjectId), visits);
  for (const id of studentIds) out.set(id, left.get(leftKey(id, subjectId)) ?? { left: 0, total: 0, unpaid: 0 });
  return out;
}

// Остаток оплаченных занятий у всех (или указанных) учеников по всем предметам:
// leftKey(studentId, subjectId) -> { left, total, unpaid }. Для напоминаний об оплате.
export async function lessonsLeftAll(studentIds: string[]): Promise<Map<string, LessonsLeft>> {
  if (studentIds.length === 0) return new Map();
  const [credits, att, groups] = await Promise.all([
    loadCredits(studentIds),
    prisma.attendance.findMany({
      where: { studentId: { in: studentIds }, date: { gte: packageBillingStart() }, lesson: { group: { subjectId: { not: null } } } },
      select: { studentId: true, present: true, excused: true, date: true, lesson: { select: { groupId: true } } },
    }),
    prisma.group.findMany({ where: { subjectId: { not: null } }, select: { id: true, subjectId: true } }),
  ]);
  const subjectOf = new Map(groups.map((g) => [g.id, g.subjectId!]));
  const visits: Visit[] = [];
  for (const a of att) {
    const subjectId = subjectOf.get(a.lesson.groupId);
    if (!subjectId || !isPayableAttendance(a.present, a.excused)) continue;
    visits.push({ studentId: a.studentId, subjectId, groupId: a.lesson.groupId, date: a.date });
  }
  return lessonsLeft(credits, visits);
}

// Предоплата по всей школе: subjectId -> { занятий, ₸ } оплачено, но ещё не проведено.
export async function prepaidAll(): Promise<Map<string, { lessons: number; amount: number }>> {
  const students = await prisma.student.findMany({ where: { payments: { some: { paidAmount: { gt: 0 } } } }, select: { id: true } });
  const ids = students.map((s) => s.id);
  if (ids.length === 0) return new Map();
  const [credits, att, groups] = await Promise.all([
    loadCredits(ids),
    prisma.attendance.findMany({
      where: { studentId: { in: ids }, date: { gte: packageBillingStart() }, lesson: { group: { subjectId: { not: null } } } },
      select: { studentId: true, present: true, excused: true, date: true, lesson: { select: { groupId: true } } },
    }),
    prisma.group.findMany({ where: { subjectId: { not: null } }, select: { id: true, subjectId: true } }),
  ]);
  const subjectOf = new Map(groups.map((g) => [g.id, g.subjectId!]));
  const visits: Visit[] = [];
  for (const a of att) {
    const subjectId = subjectOf.get(a.lesson.groupId);
    if (!subjectId || !isPayableAttendance(a.present, a.excused)) continue;
    visits.push({ studentId: a.studentId, subjectId, groupId: a.lesson.groupId, date: a.date });
  }
  return prepaidBySubject(credits, visits);
}
