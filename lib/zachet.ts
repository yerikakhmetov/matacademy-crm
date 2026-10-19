// Зачёты: чистые функции (без БД), покрыты тестами в zachet.test.ts.

// Дата и время зачёта вводятся по часам школы («2026-10-20» + «15:30»),
// а хранятся моментом UTC: в Алматы (+5) 15:30 — это 10:30 UTC.
export function schoolDateTimeToUtc(date: string, time: string, tz: number): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const t = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!d || !t) return null;
  const [y, m, day] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [hh, mm] = [Number(t[1]), Number(t[2])];
  if (m < 1 || m > 12 || day < 1 || day > 31 || hh > 23 || mm > 59) return null;
  return new Date(Date.UTC(y, m - 1, day, hh - tz, mm));
}

// Обратно — для полей формы при правке: { date: "2026-10-20", time: "15:30" } по часам школы.
export function utcToSchoolParts(at: Date, tz: number): { date: string; time: string } {
  const s = new Date(at.getTime() + tz * 3_600_000).toISOString();
  return { date: s.slice(0, 10), time: s.slice(11, 16) };
}

// Состояние зачёта для ученика:
//   passed / failed — куратор отметил;
//   upcoming — ещё не наступил;
//   pending — время прошло, а отметки нет (куратору — напоминание отметить).
export type ZachetStatus = "passed" | "failed" | "upcoming" | "pending";

export function zachetStatus(scheduledAt: Date, result: { passed: boolean } | null | undefined, now: Date = new Date()): ZachetStatus {
  if (result) return result.passed ? "passed" : "failed";
  return scheduledAt.getTime() > now.getTime() ? "upcoming" : "pending";
}

// Сводка по группе: сколько сдали / не сдали / ещё не отмечены.
export function zachetSummary(studentIds: string[], results: { studentId: string; passed: boolean }[]) {
  const byStudent = new Map(results.map((r) => [r.studentId, r.passed]));
  let passed = 0;
  let failed = 0;
  for (const id of studentIds) {
    const r = byStudent.get(id);
    if (r === true) passed++;
    else if (r === false) failed++;
  }
  return { passed, failed, unmarked: studentIds.length - passed - failed, total: studentIds.length };
}

// Главный экран куратора: ближайшие зачёты (в пределах aheadDays) и прошедшие,
// где остались ученики без отметки, — их нужно отметить. Прошедшие, отмеченные полностью, не показываем.
export function zachetAgenda<Z extends { scheduledAt: Date; studentIds: string[]; results: { studentId: string; passed: boolean }[] }>(
  zachets: Z[],
  now: Date = new Date(),
  aheadDays = 7,
) {
  const t = now.getTime();
  const horizon = t + aheadDays * 86_400_000;
  const upcoming = zachets
    .filter((z) => z.scheduledAt.getTime() > t && z.scheduledAt.getTime() <= horizon)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  const toMark = zachets
    .filter((z) => z.scheduledAt.getTime() <= t)
    .map((z) => ({ ...z, summary: zachetSummary(z.studentIds, z.results) }))
    .filter((z) => z.summary.unmarked > 0)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  return { upcoming, toMark };
}
