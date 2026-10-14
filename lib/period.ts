// Подпись периода счёта.
// Новые счета — по месяцам обучения (пакетам занятий): «2–4-й месяцы».
// Старые (studyMonth = null) — за календарный месяц: «октябрь 2026», «окт – дек 2026».
// Чистые функции, покрыты тестами в period.test.ts.
import { studyMonthLabel } from "./packages.ts";

const SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const FULL = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];

export const MAX_PERIOD_MONTHS = 12;

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

export function invoicePeriodLabel(p: { date: Date; months: number; studyMonth: number | null }): string {
  return p.studyMonth != null ? studyMonthLabel(p.studyMonth, p.months) : periodLabel(p.date, p.months);
}
