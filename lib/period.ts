// Период счёта: за какой месяц (и на сколько месяцев вперёд) платит ученик.
// Хранится в Payment.date (месяц начала) и Payment.months. От него зависят
// «оплачено до», доля предмета в зарплате каждого месяца и долги.
// Чистые функции, покрыты тестами в period.test.ts.

const SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const FULL = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];

export const MAX_PERIOD_MONTHS = 12;

export const periodKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

// «2026-11» → 1 ноября 2026 (UTC-полночь), мусор → null
export function parsePeriodMonth(v: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(String(v ?? "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12 || y < 2000 || y > 2100) return null;
  return new Date(Date.UTC(y, mo - 1, 1));
}

// Дата счёта для выбранного месяца. Текущий месяц — сегодняшним днём: счёт с датой
// 1-го числа, выставленный 14-го, сразу считался бы просроченным. Будущий и прошлый — 1-м числом.
export function periodStartDate(month: Date, today: Date): Date {
  const sameMonth = month.getUTCFullYear() === today.getUTCFullYear() && month.getUTCMonth() === today.getUTCMonth();
  return sameMonth ? new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) : month;
}

// «октябрь 2026» или «окт – дек 2026» / «дек 2026 – фев 2027»
export function periodLabel(start: Date, months: number): string {
  const n = Math.max(1, months);
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth();
  if (n === 1) return `${FULL[m]} ${y}`;
  const end = new Date(Date.UTC(y, m + n - 1, 1));
  const ey = end.getUTCFullYear();
  return ey === y ? `${SHORT[m]} – ${SHORT[end.getUTCMonth()]} ${y}` : `${SHORT[m]} ${y} – ${SHORT[end.getUTCMonth()]} ${ey}`;
}

// Месяцы для выбора: несколько прошлых (долги) и год вперёд (предоплата).
export function periodOptions(today: Date, back = 3, ahead = 12): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let i = -back; i <= ahead; i++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + i, 1));
    out.push({ value: periodKey(d), label: `${FULL[d.getUTCMonth()]} ${d.getUTCFullYear()}` });
  }
  return out;
}
