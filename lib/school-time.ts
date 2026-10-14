// Время школы. Сервер в облаке живёт по UTC, а школа — по своему поясу
// (Settings.tzOffsetHours, Алматы = +5). Без поправки оплата, принятая
// 1-го числа в 02:00, попадала в прошлый месяц, а «сегодня» до 05:00 было вчера.
// Чистые функции, покрыты тестами в school-time.test.ts.

const HOUR = 3_600_000;

// «Часы школы» как Date, у которого getUTC* дают местные дату и время.
export function schoolClock(tz: number, now: number = Date.now()): Date {
  return new Date(now + tz * HOUR);
}

// Сегодняшняя дата школы, UTC-полночью — так хранятся все даты без времени.
export function schoolToday(tz: number, now: number = Date.now()): Date {
  const c = schoolClock(tz, now);
  return new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth(), c.getUTCDate()));
}

// Момент, когда у школы начинается месяц (местная полночь 1-го числа), в UTC.
// month0 может выходить за 0..11 — Date.UTC сам переносит год.
export function schoolMonthStart(year: number, month0: number, tz: number): Date {
  return new Date(Date.UTC(year, month0, 1, -tz));
}

// Месяц школы, в который попадает момент: «2026-9» (month0 без ведущего нуля).
// Даты без времени (UTC-полночь) при tz ≥ 0 остаются в своём дне.
export function schoolMonthKey(d: Date, tz: number): string {
  const c = new Date(d.getTime() + tz * HOUR);
  return `${c.getUTCFullYear()}-${c.getUTCMonth()}`;
}

// Последние count месяцев школы, от старых к новым.
export function lastSchoolMonths(count: number, tz: number, now: number = Date.now()) {
  const c = schoolClock(tz, now);
  const out: { key: string; year: number; month0: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() - i, 1));
    out.push({ key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`, year: d.getUTCFullYear(), month0: d.getUTCMonth() });
  }
  return out;
}

// Понедельник недели, в которую попадает дата (UTC-полночь).
export function weekMonday(d: Date): Date {
  const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - (dow - 1)));
}

// Неделя из ?week=YYYY-MM-DD (любой день недели) или текущая неделя школы.
export function parseWeek(param: string | undefined, today: Date): Date {
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
    const d = new Date(param + "T00:00:00.000Z");
    if (!isNaN(d.getTime())) return weekMonday(d);
  }
  return weekMonday(today);
}

export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
