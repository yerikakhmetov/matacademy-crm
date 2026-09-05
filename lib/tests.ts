// Когда тест становится доступен ученику: после времени урока по расписанию.
// Часовой пояс школы задаётся в настройках (Settings.tzOffsetHours), по умолчанию Алматы = UTC+5.
export const DEFAULT_TZ_OFFSET_HOURS = 5;

// Момент (UTC), с которого тест открыт: дата теста + время самого позднего урока
// группы в этот день недели. Если урока в этот день нет — начало дня теста.
export function testAvailableAt(
  date: Date,
  lessons: { dayOfWeek: number; startTime: string }[],
  tzOffsetHours: number = DEFAULT_TZ_OFFSET_HOURS
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
  return new Date(Date.UTC(y, m, day, hh - tzOffsetHours, mm, 0));
}

// Доступен ли тест ученику прямо сейчас (по расписанию).
export function isTestOpen(
  date: Date,
  lessons: { dayOfWeek: number; startTime: string }[],
  now: Date = new Date(),
  tzOffsetHours: number = DEFAULT_TZ_OFFSET_HOURS
): boolean {
  return now.getTime() >= testAvailableAt(date, lessons, tzOffsetHours).getTime();
}

// Детерминированное перемешивание вопросов: у каждого ученика свой порядок,
// но при обновлении страницы он не меняется (иначе можно было бы «крутить» варианты).
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shuffleForSeed<T>(items: T[], seed: string): T[] {
  const out = [...items];
  let state = hashSeed(seed) || 1;
  const next = () => {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
