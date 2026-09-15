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

// ---- Исправление уже созданного счёта ----
//
// Главная тонкость: деньги могли уже прийти. paidAmount — это кэш суммы
// приходов в PaymentTx, а доход месяца считается по самим движениям. Поэтому
// поменять одно поле счёта нельзя: разъедутся счёт, доход и долг ученика.

export type EditTx = { id: string; kind: string; amount: number };

export type PaymentEditPlan =
  // Оплата принята одним движением целиком («Принять оплату» с опечаткой в сумме):
  // исправляем и счёт, и сам приход — иначе доход останется с неверной суммой.
  | { ok: true; mode: "single"; txId: string; paidAmount: number }
  // Меняется только сумма счёта, история денег не трогается.
  | { ok: true; mode: "invoice"; paidAmount: number }
  | { ok: false; error: string };

export function planPaymentEdit(
  cur: { amount: number; paidAmount: number; refundedAmount: number; txs: EditTx[] },
  newAmount: number,
  alsoReceived: boolean
): PaymentEditPlan {
  if (!Number.isFinite(newAmount) || newAmount <= 0) {
    return { ok: false, error: "Сумма должна быть больше нуля" };
  }
  const payments = cur.txs.filter((t) => t.kind === "PAYMENT");
  const refunds = cur.txs.filter((t) => t.kind === "REFUND");

  // Переписать приход можно только когда он однозначен: одно движение, без
  // возвратов, счёт закрыт им целиком. Иначе непонятно, какое движение неверное.
  const singleFull =
    payments.length === 1 && refunds.length === 0 && cur.paidAmount === cur.amount && payments[0].amount === cur.amount;

  if (alsoReceived && singleFull) {
    return { ok: true, mode: "single", txId: payments[0].id, paidAmount: newAmount };
  }

  // Меняем только счёт. Меньше уже полученного он быть не может: получилось бы,
  // что приняли больше, чем выставили, — лишние деньги оформляются возвратом.
  if (newAmount < cur.paidAmount) {
    return {
      ok: false,
      error: `По счёту уже принято ${cur.paidAmount} ₸ — сумма счёта не может быть меньше. Лишнее оформите возвратом.`,
    };
  }
  return { ok: true, mode: "invoice", paidAmount: cur.paidAmount };
}

// Можно ли в форме предложить «исправить и принятую сумму».
export function canFixReceived(cur: { amount: number; paidAmount: number; txs: EditTx[] }): boolean {
  const payments = cur.txs.filter((t) => t.kind === "PAYMENT");
  const refunds = cur.txs.filter((t) => t.kind === "REFUND");
  return payments.length === 1 && refunds.length === 0 && cur.paidAmount === cur.amount && payments[0].amount === cur.amount;
}
