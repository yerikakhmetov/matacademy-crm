// Чистая логика оплат (без БД) — частичные оплаты и возвраты.
//
// Счёт (Payment) хранит сумму к оплате `amount`, а фактические движения денег
// лежат в PaymentTx: приход (PAYMENT) и возврат (REFUND), у каждого своя дата.
// Поэтому возврат в октябре уменьшает доход октября, а не того месяца,
// когда был выставлен счёт.

export type PaymentStatus = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";

// Сколько ещё должны по счёту. Возврат долг не создаёт: если счёт был закрыт,
// а деньги вернули (отказ от услуги), задолженность заново не появляется.
export function outstanding(amount: number, paidAmount: number): number {
  return Math.max(0, amount - paidAmount);
}

// Фактически полученные деньги по счёту.
export function netReceived(paidAmount: number, refundedAmount: number): number {
  return paidAmount - refundedAmount;
}

// Статус счёта по деньгам и сроку. dueDate в прошлом и долг остался → просрочен.
export function paymentStatus(
  amount: number,
  paidAmount: number,
  date: Date,
  now: Date = new Date()
): PaymentStatus {
  if (paidAmount >= amount && amount > 0) return "PAID";
  if (paidAmount > 0) return "PARTIAL";
  return date < startOfDay(now) ? "OVERDUE" : "PENDING";
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Доля счёта, которая реально оплачена — ею масштабируется разбивка по предметам,
// иначе наполовину оплаченный счёт давал бы предмету (и преподавателю) полную сумму.
export function settledRatio(amount: number, paidAmount: number, refundedAmount: number): number {
  if (amount <= 0) return 0;
  const net = netReceived(paidAmount, refundedAmount);
  if (net <= 0) return 0;
  return Math.min(1, net / amount);
}

// Сколько можно принять/вернуть — защита от опечатки на порядок.
export function maxAcceptable(amount: number, paidAmount: number): number {
  return outstanding(amount, paidAmount);
}

export function maxRefundable(paidAmount: number, refundedAmount: number): number {
  return Math.max(0, paidAmount - refundedAmount);
}
