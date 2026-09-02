// Когда тест становится доступен ученику: после времени урока по расписанию.
// Школа в Алматы (UTC+5, без переходов на летнее время).
const ALMATY_OFFSET_HOURS = 5;

// Момент (UTC), с которого тест открыт: дата теста + время самого позднего урока
// группы в этот день недели. Если урока в этот день нет — начало дня теста.
export function testAvailableAt(
  date: Date,
  lessons: { dayOfWeek: number; startTime: string }[]
): Date {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const jsDay = d.getUTCDay(); // 0 = вс
  const dow = jsDay === 0 ? 7 : jsDay; // 1..6 = Пн..Сб

  const sameDay = lessons.filter((l) => l.dayOfWeek === dow).map((l) => l.startTime).sort();
  let hh = 0;
  let mm = 0;
  if (sameDay.length > 0) {
    const latest = sameDay[sameDay.length - 1]; // "16:00"
    const [h, mi] = latest.split(":").map((x) => parseInt(x, 10));
    hh = isNaN(h) ? 0 : h;
    mm = isNaN(mi) ? 0 : mi;
  }
  // локальное время урока → UTC
  return new Date(Date.UTC(y, m, day, hh - ALMATY_OFFSET_HOURS, mm, 0));
}

// Доступен ли тест ученику прямо сейчас (по расписанию).
export function isTestOpen(date: Date, lessons: { dayOfWeek: number; startTime: string }[], now: Date = new Date()): boolean {
  return now.getTime() >= testAvailableAt(date, lessons).getTime();
}
