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

// До какого числа оплачено: конец непрерывной цепочки полностью оплаченных месяцев.
// Счёт на N месяцев покрывает N месяцев со своего. Цепочка рвётся на первом неоплаченном
// месяце: оплачены октябрь и декабрь–февраль, ноябрь нет → «до 31 октября», а не до февраля.
//  - текущий месяц оплачен — идём от него вперёд, пока месяцы оплачены подряд;
//  - не оплачен — последний оплаченный месяц до него (предоплата за будущее не в счёт:
//    за текущий месяц ученик всё равно должен);
//  - оплачено только будущее или ничего — null.
export function paidThrough(
  payments: { amount: number; paidAmount: number; date: Date; months: number }[],
  today: Date = new Date()
): Date | null {
  const idx = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();
  const covered = new Set<number>();
  for (const p of payments) {
    if (p.amount <= 0 || p.paidAmount < p.amount) continue;
    for (let k = 0; k < Math.max(1, p.months); k++) covered.add(idx(p.date) + k);
  }
  const cur = idx(today);
  let last: number;
  if (covered.has(cur)) {
    last = cur;
    while (covered.has(last + 1)) last++;
  } else {
    const before = [...covered].filter((m) => m < cur);
    if (before.length === 0) return null;
    last = Math.max(...before);
  }
  // последний день месяца last: нулевое число следующего месяца
  return new Date(Date.UTC(Math.floor(last / 12), (last % 12) + 1, 0));
}

// Доля предмета в приходе денег: счёт оплачивает несколько предметов сразу,
// и приход делится между ними в той же пропорции, что и сам счёт (строки PaymentItem).
// Так на странице группы видно, сколько из 40 500 ₸ пришлось именно на её предмет.
export function subjectShareOfTx(txAmount: number, paymentAmount: number, subjectItemAmount: number): number {
  if (paymentAmount <= 0 || subjectItemAmount <= 0) return 0;
  return Math.round((txAmount * Math.min(subjectItemAmount, paymentAmount)) / paymentAmount);
}
