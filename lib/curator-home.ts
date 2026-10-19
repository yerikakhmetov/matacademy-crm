// Главный экран куратора: кто из учеников его групп часто пропускает.
// Чистая функция (без БД), покрыта тестами в curator-home.test.ts.

export type AbsenceMark = { studentId: string; present: boolean; excused: boolean };

export type Absentee = { studentId: string; missed: number; unexcused: number };

// Ученики, пропустившие не меньше minMissed занятий (любых — и по уважительной причине:
// куратору важно знать о любом выпадении из учёбы). Сначала больше прогулов без причины.
export function frequentAbsentees(marks: AbsenceMark[], minMissed = 2): Absentee[] {
  const by = new Map<string, Absentee>();
  for (const m of marks) {
    if (m.present) continue;
    let a = by.get(m.studentId);
    if (!a) by.set(m.studentId, (a = { studentId: m.studentId, missed: 0, unexcused: 0 }));
    a.missed += 1;
    if (!m.excused) a.unexcused += 1;
  }
  return [...by.values()]
    .filter((a) => a.missed >= minMissed)
    .sort((a, b) => b.unexcused - a.unexcused || b.missed - a.missed);
}

// Ученики со слабыми домашними за месяц: средний процент по ДЗ ниже порога.
// Оценки уже отфильтрованы по месяцу и группам куратора. Сначала самые низкие.
export type HwGrade = { studentId: string; type: string; score: number; maxScore: number };

export function lowHomework(grades: HwGrade[], threshold = 60): { studentId: string; avg: number; count: number }[] {
  const by = new Map<string, { sum: number; count: number }>();
  for (const g of grades) {
    if (g.type !== "HOMEWORK" || g.maxScore <= 0) continue;
    const a = by.get(g.studentId) ?? { sum: 0, count: 0 };
    a.sum += (g.score / g.maxScore) * 100;
    a.count += 1;
    by.set(g.studentId, a);
  }
  return [...by.entries()]
    .map(([studentId, a]) => ({ studentId, avg: Math.round(a.sum / a.count), count: a.count }))
    .filter((r) => r.avg < threshold)
    .sort((a, b) => a.avg - b.avg);
}
