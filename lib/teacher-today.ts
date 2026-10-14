// Главный экран преподавателя: статус сегодняшних занятий и какое из них показать первым.
// Чистые функции (без БД), покрыты тестами в teacher-today.test.ts.

export type LessonStatus = "cancelled" | "marked" | "due" | "upcoming";

export type TodayLesson = { id: string; startTime: string; marked: boolean; cancelled: boolean };

// Время — строки "HH:MM" по часовому поясу школы, поэтому сравниваются как строки.
export function lessonStatus(l: TodayLesson, nowHHMM: string): LessonStatus {
  if (l.cancelled) return "cancelled";
  if (l.marked) return "marked";
  return l.startTime <= nowHHMM ? "due" : "upcoming";
}

// Что показать крупно: сначала занятие, которое уже началось и не отмечено
// (самое раннее — оно «горит» дольше всех), иначе ближайшее предстоящее.
export function pickFocus<T extends TodayLesson>(lessons: T[], nowHHMM: string): { lesson: T; status: LessonStatus } | null {
  const sorted = [...lessons].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const due = sorted.find((l) => lessonStatus(l, nowHHMM) === "due");
  if (due) return { lesson: due, status: "due" };
  const next = sorted.find((l) => lessonStatus(l, nowHHMM) === "upcoming");
  return next ? { lesson: next, status: "upcoming" } : null;
}

// Минут до начала (отрицательное — уже идёт).
export function minutesUntil(startTime: string, nowHHMM: string): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  return toMin(startTime) - toMin(nowHHMM);
}

// Ближайшее занятие в следующие дни, если сегодня больше нечего отмечать.
// dayOfWeek: 1 = Пн … 7 = Вс (как в расписании).
export function nextLessonAfterToday<T extends { dayOfWeek: number; startTime: string }>(
  lessons: T[],
  todayDow: number
): { lesson: T; daysAhead: number } | null {
  let best: { lesson: T; daysAhead: number } | null = null;
  for (const l of lessons) {
    const ahead = ((l.dayOfWeek - todayDow + 7) % 7) || 7;
    if (!best || ahead < best.daysAhead || (ahead === best.daysAhead && l.startTime < best.lesson.startTime)) {
      best = { lesson: l, daysAhead: ahead };
    }
  }
  return best;
}
