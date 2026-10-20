// Рейтинг ученика в группе за месяц: очки за всё, что зависит от самого ученика.
// Не только оценки — старательный ученик с невысокими баллами тоже может быть наверху.
// Чистая функция (без БД), покрыта тестами в rating.test.ts.

export const RATING_POINTS = {
  attend: 2, // за каждое занятие, на котором был
  hw: 3, // за каждое выполненное ДЗ
  zachet: 5, // за сданный зачёт
  // оценка: от 0 до 10 очков — процент ÷ 10, с округлением
};

export type RatingParts = { attend: number; grades: number; hw: number; zachet: number };
export type RatingRow = { studentId: string; points: number; place: number; parts: RatingParts };

export function gradePoints(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return Math.max(0, Math.min(10, Math.round((score / maxScore) * 10)));
}

export function computeRating(input: {
  studentIds: string[];
  attendance: { studentId: string; present: boolean }[];
  grades: { studentId: string; score: number; maxScore: number }[];
  homeworkDone: { studentId: string }[];
  zachetPassed: { studentId: string }[];
}): RatingRow[] {
  const parts = new Map<string, RatingParts>(input.studentIds.map((id) => [id, { attend: 0, grades: 0, hw: 0, zachet: 0 }]));
  for (const a of input.attendance) {
    const p = parts.get(a.studentId);
    if (p && a.present) p.attend += RATING_POINTS.attend;
  }
  for (const g of input.grades) {
    const p = parts.get(g.studentId);
    if (p) p.grades += gradePoints(g.score, g.maxScore);
  }
  for (const h of input.homeworkDone) {
    const p = parts.get(h.studentId);
    if (p) p.hw += RATING_POINTS.hw;
  }
  for (const z of input.zachetPassed) {
    const p = parts.get(z.studentId);
    if (p) p.zachet += RATING_POINTS.zachet;
  }

  const rows = [...parts].map(([studentId, pr]) => ({ studentId, parts: pr, points: pr.attend + pr.grades + pr.hw + pr.zachet }));
  rows.sort((a, b) => b.points - a.points);
  // одинаковые очки — одинаковое место: 1, 1, 3
  let place = 0;
  return rows.map((r, i) => {
    if (i === 0 || r.points !== rows[i - 1].points) place = i + 1;
    return { ...r, place };
  });
}
