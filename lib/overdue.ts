import { prisma } from "./prisma";

// Внутренние серверные помощники (НЕ server actions) — вызываются из авторизованных
// действий и из cron. Не содержат проверки прав: вызывающая сторона отвечает за доступ.

// Пересчёт задолженности ученика: долг = сумма неоплаченных счетов (PENDING + OVERDUE).
// Баланс отрицательный = долг.
export async function recalc(studentId: string) {
  const unpaid = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: { studentId, status: { in: ["PENDING", "OVERDUE"] } },
  });
  const debt = unpaid._sum.amount ?? 0;
  await prisma.student.update({ where: { id: studentId }, data: { balance: -debt } });
}

// Автопометка просроченных счетов: PENDING со сроком раньше сегодняшнего → OVERDUE.
export async function markOverdue() {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const res = await prisma.payment.updateMany({
    where: { status: "PENDING", date: { lt: start } },
    data: { status: "OVERDUE" },
  });
  if (res.count > 0) {
    const affected = await prisma.payment.findMany({ where: { status: "OVERDUE" }, select: { studentId: true }, distinct: ["studentId"] });
    for (const a of affected) await recalc(a.studentId);
  }
  return res.count;
}
