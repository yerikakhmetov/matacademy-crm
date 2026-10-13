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
  // Сначала узнаём, какие счета станут просроченными: пересчитывать долг нужно
  // только их ученикам, а не всем должникам школы. Обычно список пуст — тогда это
  // один быстрый запрос по индексу (status, date), и страницы его не замечают.
  const due = await prisma.payment.findMany({
    where: { status: "PENDING", date: { lt: start } },
    select: { id: true, studentId: true },
  });
  if (due.length === 0) return 0;
  const res = await prisma.payment.updateMany({
    where: { id: { in: due.map((p) => p.id) }, status: "PENDING" },
    data: { status: "OVERDUE" },
  });
  const students = [...new Set(due.map((p) => p.studentId))];
  await Promise.all(students.map((id) => recalc(id)));
  return res.count;
}
