import { prisma } from "./prisma";
import { outstanding } from "./payments.ts";

// Внутренние серверные помощники (НЕ server actions) — вызываются из авторизованных
// действий и из cron. Не содержат проверки прав: вызывающая сторона отвечает за доступ.

// Пересчёт задолженности ученика: долг = неоплаченные остатки по счетам.
// Частично оплаченный счёт добавляет только остаток, а не всю сумму.
// Возврат долг не создаёт: если счёт закрыт, а деньги вернули, задолженность не возникает.
export async function recalc(studentId: string) {
  const rows = await prisma.payment.findMany({
    where: { studentId, status: { in: ["PENDING", "OVERDUE", "PARTIAL"] } },
    select: { amount: true, paidAmount: true },
  });
  const debt = rows.reduce((a, p) => a + outstanding(p.amount, p.paidAmount), 0);
  await prisma.student.update({ where: { id: studentId }, data: { balance: -debt } });
}

// Автопометка просроченных счетов: PENDING со сроком раньше сегодняшнего → OVERDUE.
// Частично оплаченные (PARTIAL) не трогаем — по ним уже видно, что долг остался.
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
