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
