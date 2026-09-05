import { prisma } from "./prisma";

// Доход считается по движениям денег (PaymentTx), а не по дате счёта:
// частичная оплата попадает в тот месяц, когда её принесли, а возврат
// уменьшает доход того месяца, когда деньги вернули.

export function txSign(kind: string): 1 | -1 {
  return kind === "REFUND" ? -1 : 1;
}

// Чистый доход за период (приходы минус возвраты).
export async function netRevenue(from: Date, to?: Date): Promise<number> {
  const rows = await prisma.paymentTx.groupBy({
    by: ["kind"],
    where: { date: { gte: from, ...(to ? { lt: to } : {}) } },
    _sum: { amount: true },
  });
  return rows.reduce((a, r) => a + txSign(r.kind) * (r._sum.amount ?? 0), 0);
}

// Движения за период — для разбивки по месяцам и способам оплаты.
export async function txsSince(from: Date) {
  return prisma.paymentTx.findMany({
    where: { date: { gte: from } },
    select: {
      kind: true,
      amount: true,
      date: true,
      method: true,
      payment: { select: { method: true, studentId: true } },
    },
  });
}
