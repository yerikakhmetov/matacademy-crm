// Оценки всей группе за раз: из полей «score_<studentId>» — список баллов.
// Чистая функция (без БД), покрыта тестами в grade-bulk.test.ts.
// Пустое поле — ученик пропущен (не был, не сдал); число вне 0..max — ошибка с именем ученика.

export function parseBulkScores(
  raw: Record<string, string>,
  students: { id: string; name: string }[],
  maxScore: number,
): { scores: { studentId: string; score: number }[]; error?: string } {
  const scores: { studentId: string; score: number }[] = [];
  for (const s of students) {
    const v = (raw[s.id] ?? "").trim().replace(",", ".");
    if (v === "") continue;
    if (!/^\d+(\.\d+)?$/.test(v)) return { scores: [], error: `${s.name}: «${v}» — не число` };
    const score = Math.round(Number(v));
    if (score > maxScore) return { scores: [], error: `${s.name}: ${score} больше максимума ${maxScore}` };
    scores.push({ studentId: s.id, score });
  }
  return { scores };
}
