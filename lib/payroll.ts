import { money } from "./format";

// Единая логика расчёта зарплаты преподавателя за месяц.
// Используется страницей «Зарплата», «Моя зарплата», отчётами и фиксацией месяца.

export type TeacherForCalc = {
  rate: number;
  rateType: string;
  groups: { id: string; _count: { students: number }; lessons: { dayOfWeek: number }[] }[];
  subjects: { id: string }[];
};

export type CalcCtx = {
  year: number;
  month0: number;
  revByGroup: Map<string, number>; // доход по группе за этот месяц (для PERCENT)
  revBySubject: Map<string, number>; // доход по предмету за этот месяц (для PERCENT_SUBJECT)
  subjTeacherCount: Map<string, number>; // сколько PERCENT_SUBJECT-преподавателей у предмета (для деления)
};

// Сколько раз день недели встречается в месяце (dayOfWeek: 1=Пн..7=Вс)
export function datesInMonth(year: number, month0: number, dayOfWeek: number): number {
  let count = 0;
  const d = new Date(Date.UTC(year, month0, 1));
  while (d.getUTCMonth() === month0) {
    const js = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    if (js === dayOfWeek) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

export function computeSalary(t: TeacherForCalc, ctx: CalcCtx): { base: number; baseLabel: string; salary: number } {
  if (t.rateType === "PER_STUDENT") {
    const base = t.groups.reduce((a, g) => a + g._count.students, 0);
    return { base, baseLabel: `${base} учеников`, salary: base * t.rate };
  }
  if (t.rateType === "PERCENT") {
    const rev = t.groups.reduce((a, g) => a + (ctx.revByGroup.get(g.id) ?? 0), 0);
    return { base: rev, baseLabel: money(rev), salary: Math.round((rev * t.rate) / 100) };
  }
  if (t.rateType === "PERCENT_SUBJECT") {
    // доход предмета делится поровну между его PERCENT_SUBJECT-преподавателями
    const rev = t.subjects.reduce((a, s) => {
      const total = ctx.revBySubject.get(s.id) ?? 0;
      const share = total / Math.max(1, ctx.subjTeacherCount.get(s.id) ?? 1);
      return a + share;
    }, 0);
    return {
      base: Math.round(rev),
      baseLabel: t.subjects.length ? money(Math.round(rev)) : "нет предметов",
      salary: Math.round((rev * t.rate) / 100),
    };
  }
  // PER_LESSON
  const lessons = t.groups.reduce((a, g) => a + g.lessons.reduce((la, l) => la + datesInMonth(ctx.year, ctx.month0, l.dayOfWeek), 0), 0);
  return { base: lessons, baseLabel: `${lessons} уроков`, salary: lessons * t.rate };
}

// Число PERCENT_SUBJECT-преподавателей на каждый предмет — для деления дохода предмета.
export function subjectTeacherCounts(teachers: { rateType: string; subjects: { id: string }[] }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of teachers) {
    if (t.rateType !== "PERCENT_SUBJECT") continue;
    for (const s of t.subjects) m.set(s.id, (m.get(s.id) ?? 0) + 1);
  }
  return m;
}
