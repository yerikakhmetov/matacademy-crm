import { prisma } from "./prisma";

// Единая логика зарплаты преподавателя (по посещаемости).
//
// Модель: из месячной доли ученика по предмету удерживается schoolFeePct% (доход школы),
// остаток делится на (занятий в неделю × 4). Это цена одного занятия одного ученика.
// Преподаватель получает её за каждое «оплачиваемое» посещение:
//   присутствовал ИЛИ отсутствовал без уважительной причины.
// За отсутствие по уважительной причине за этого ученика в этот день не платят.

export type PayrollRow = {
  teacherId: string;
  students: number; // сколько учеников принесли оплату в этом месяце
  paidLessons: number; // оплачиваемых посещений (ученико-занятий)
  base: number; // начислено до удержания школы, ₸
  salary: number; // к выплате, ₸
};

// Месячная зарплата всех преподавателей за (year, month0). feePct — удержание школы, %.
export async function gatherPayroll(year: number, month0: number, feePct: number): Promise<Map<string, PayrollRow>> {
  const monthStart = new Date(Date.UTC(year, month0, 1));
  const monthEnd = new Date(Date.UTC(year, month0 + 1, 1));
  const net = Math.max(0, 100 - Math.max(0, feePct)) / 100;

  const teachers = await prisma.teacher.findMany({
    select: {
      id: true,
      groups: {
        select: {
          id: true,
          subjectId: true,
          students: { select: { id: true } },
          lessons: { select: { id: true } },
        },
      },
    },
  });

  const lessonToGroup = new Map<string, string>();
  const studentIds = new Set<string>();
  for (const t of teachers) {
    for (const g of t.groups) {
      for (const l of g.lessons) lessonToGroup.set(l.id, g.id);
      for (const s of g.students) studentIds.add(s.id);
    }
  }
  const allLessonIds = [...lessonToGroup.keys()];

  // Посещаемость за месяц по этим урокам
  const att = allLessonIds.length
    ? await prisma.attendance.findMany({
        where: { lessonId: { in: allLessonIds }, date: { gte: monthStart, lt: monthEnd } },
        select: { lessonId: true, studentId: true, present: true, excused: true },
      })
    : [];
  const payable = new Map<string, number>(); // groupId|studentId -> оплачиваемых посещений
  for (const a of att) {
    const gid = lessonToGroup.get(a.lessonId);
    if (!gid) continue;
    const pay = a.present || !a.excused; // присутствовал ИЛИ отсутствовал без уважительной
    if (!pay) continue;
    const k = gid + "|" + a.studentId;
    payable.set(k, (payable.get(k) ?? 0) + 1);
  }

  // Месячная доля ученика по предмету (из активных в этом месяце абонементов)
  const subs = studentIds.size
    ? await prisma.subscription.findMany({
        where: {
          studentId: { in: [...studentIds] },
          startDate: { lt: monthEnd },
          OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
        },
        select: { studentId: true, months: true, items: { select: { subjectId: true, amount: true } } },
      })
    : [];
  const monthlyFee = new Map<string, number>(); // studentId|subjectId -> ₸/мес
  for (const sub of subs) {
    const mm = Math.max(1, sub.months);
    for (const it of sub.items) {
      if (!it.subjectId) continue;
      const k = sub.studentId + "|" + it.subjectId;
      monthlyFee.set(k, (monthlyFee.get(k) ?? 0) + it.amount / mm);
    }
  }

  const rows = new Map<string, PayrollRow>();
  for (const t of teachers) {
    let gross = 0;
    let paidLessons = 0;
    const studs = new Set<string>();
    for (const g of t.groups) {
      const divisor = g.lessons.length * 4; // занятий в неделю × 4
      if (divisor === 0 || !g.subjectId) continue;
      for (const s of g.students) {
        const pl = payable.get(g.id + "|" + s.id) ?? 0;
        if (pl === 0) continue;
        const fee = monthlyFee.get(s.id + "|" + g.subjectId) ?? 0;
        gross += (fee / divisor) * pl;
        paidLessons += pl;
        studs.add(s.id);
      }
    }
    rows.set(t.id, { teacherId: t.id, students: studs.size, paidLessons, base: Math.round(gross), salary: Math.round(gross * net) });
  }
  return rows;
}
