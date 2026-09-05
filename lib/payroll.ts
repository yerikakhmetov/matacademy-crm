import { prisma } from "./prisma";
import { settledRatio } from "./payments.ts";
import {
  computePayrollRows,
  feeKey,
  isPayableAttendance,
  payableKey,
  scheduledLessonsInMonth,
  type PayrollRow,
  type PayrollTeacher,
} from "./payroll-calc.ts";

// Сбор данных из БД для расчёта зарплаты. Сама арифметика — в ./payroll-calc.ts (покрыта тестами).
export * from "./payroll-calc.ts";

export type Month = { year: number; month0: number };

const mKey = (year: number, month0: number) => `${year}-${month0}`;
const utcKey = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}`;

// Зарплата всех преподавателей сразу за несколько месяцев.
// Все запросы идут один раз на весь диапазон: страницы «Отчёты» и «Моя зарплата»
// показывают 6 месяцев, и по запросу на каждый месяц база сканировалась шесть раз.
export async function gatherPayrollRange(months: Month[], feePct: number): Promise<Map<string, PayrollRow>[]> {
  if (months.length === 0) return [];

  const sorted = [...months].sort((a, b) => a.year - b.year || a.month0 - b.month0);
  const rangeStart = new Date(Date.UTC(sorted[0].year, sorted[0].month0, 1));
  const last = sorted[sorted.length - 1];
  const rangeEnd = new Date(Date.UTC(last.year, last.month0 + 1, 1));

  const teachersDb = await prisma.teacher.findMany({
    select: {
      id: true,
      groups: {
        select: {
          id: true,
          subjectId: true,
          students: { select: { id: true } },
          lessons: { select: { id: true, dayOfWeek: true } },
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

  const [att, subs, payItems, cancelled] = await Promise.all([
    allLessonIds.length
      ? prisma.attendance.findMany({
          where: { lessonId: { in: allLessonIds }, date: { gte: rangeStart, lt: rangeEnd } },
          select: { lessonId: true, studentId: true, present: true, excused: true, date: true },
        })
      : Promise.resolve([]),
    ids.length
      ? prisma.subscription.findMany({
          where: {
            studentId: { in: ids },
            startDate: { lt: rangeEnd },
            OR: [{ endDate: null }, { endDate: { gte: rangeStart } }],
          },
          select: { studentId: true, months: true, startDate: true, endDate: true, items: { select: { subjectId: true, amount: true } } },
        })
      : Promise.resolve([]),
    // Резервный источник: оплаты с разбивкой по предметам — для учеников без абонемента
    ids.length
      ? prisma.paymentItem.findMany({
          where: {
            subjectId: { not: null },
            payment: { paidAmount: { gt: 0 }, studentId: { in: ids }, date: { gte: rangeStart, lt: rangeEnd } },
          },
          select: {
            subjectId: true,
            amount: true,
            payment: { select: { studentId: true, date: true, amount: true, paidAmount: true, refundedAmount: true } },
          },
        })
      : Promise.resolve([]),
    // Отменённые занятия не входят в делитель
    allLessonIds.length
      ? prisma.lessonSession.findMany({
          where: { lessonId: { in: allLessonIds }, cancelled: true, date: { gte: rangeStart, lt: rangeEnd } },
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
    const monthStart = new Date(Date.UTC(year, month0, 1));
    const monthEnd = new Date(Date.UTC(year, month0 + 1, 1));

    // Абонементы, действующие в этом месяце
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
    const paidFee = paidFeeByMonth.get(mk);
    if (paidFee) for (const [k, v] of paidFee) if (!monthlyFee.has(k)) monthlyFee.set(k, v);

    const cancelledByGroup = cancelledByMonth.get(mk) ?? new Map<string, number>();
    const teachers: PayrollTeacher[] = teachersDb.map((t) => ({
      id: t.id,
      groups: t.groups.map((g) => ({
        id: g.id,
        subjectId: g.subjectId,
        scheduledLessons: Math.max(
          0,
          scheduledLessonsInMonth(year, month0, g.lessons.map((l) => l.dayOfWeek)) - (cancelledByGroup.get(g.id) ?? 0)
        ),
        studentIds: g.students.map((s) => s.id),
      })),
    }));

    return computePayrollRows({
      teachers,
      payable: payableByMonth.get(mk) ?? new Map(),
      monthlyFee,
      feePct,
    });
  });
}

// Месячная зарплата всех преподавателей за (year, month0). feePct — удержание школы, %.
export async function gatherPayroll(year: number, month0: number, feePct: number): Promise<Map<string, PayrollRow>> {
  const [rows] = await gatherPayrollRange([{ year, month0 }], feePct);
  return rows ?? new Map();
}
