import { prisma } from "./prisma";
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

// Месячная зарплата всех преподавателей за (year, month0). feePct — удержание школы, %.
export async function gatherPayroll(year: number, month0: number, feePct: number): Promise<Map<string, PayrollRow>> {
  const monthStart = new Date(Date.UTC(year, month0, 1));
  const monthEnd = new Date(Date.UTC(year, month0 + 1, 1));

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

  const [att, subs, payItems] = await Promise.all([
    allLessonIds.length
      ? prisma.attendance.findMany({
          where: { lessonId: { in: allLessonIds }, date: { gte: monthStart, lt: monthEnd } },
          select: { lessonId: true, studentId: true, present: true, excused: true },
        })
      : Promise.resolve([]),
    ids.length
      ? prisma.subscription.findMany({
          where: {
            studentId: { in: ids },
            startDate: { lt: monthEnd },
            OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
          },
          select: { studentId: true, months: true, items: { select: { subjectId: true, amount: true } } },
        })
      : Promise.resolve([]),
    // Резервный источник: оплаты за месяц с разбивкой по предметам —
    // для учеников без абонемента, иначе преподаватель за них ничего не получит.
    ids.length
      ? prisma.paymentItem.findMany({
          where: {
            subjectId: { not: null },
            payment: { status: "PAID", studentId: { in: ids }, date: { gte: monthStart, lt: monthEnd } },
          },
          select: { subjectId: true, amount: true, payment: { select: { studentId: true } } },
        })
      : Promise.resolve([]),
  ]);

  const payable = new Map<string, number>();
  for (const a of att) {
    const gid = lessonToGroup.get(a.lessonId);
    if (!gid) continue;
    if (!isPayableAttendance(a.present, a.excused)) continue;
    const k = payableKey(gid, a.studentId);
    payable.set(k, (payable.get(k) ?? 0) + 1);
  }

  // Основной источник месячной доли — абонемент
  const monthlyFee = new Map<string, number>();
  for (const sub of subs) {
    const mm = Math.max(1, sub.months);
    for (const it of sub.items) {
      if (!it.subjectId) continue;
      const k = feeKey(sub.studentId, it.subjectId);
      monthlyFee.set(k, (monthlyFee.get(k) ?? 0) + it.amount / mm);
    }
  }
  // Резерв — фактические оплаты за месяц (только там, где абонемента нет)
  const paidFee = new Map<string, number>();
  for (const it of payItems) {
    if (!it.subjectId) continue;
    const k = feeKey(it.payment.studentId, it.subjectId);
    paidFee.set(k, (paidFee.get(k) ?? 0) + it.amount);
  }
  for (const [k, v] of paidFee) if (!monthlyFee.has(k)) monthlyFee.set(k, v);

  const teachers: PayrollTeacher[] = teachersDb.map((t) => ({
    id: t.id,
    groups: t.groups.map((g) => ({
      id: g.id,
      subjectId: g.subjectId,
      scheduledLessons: scheduledLessonsInMonth(year, month0, g.lessons.map((l) => l.dayOfWeek)),
      studentIds: g.students.map((s) => s.id),
    })),
  }));

  return computePayrollRows({ teachers, payable, monthlyFee, feePct });
}
