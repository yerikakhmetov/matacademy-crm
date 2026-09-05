import { prisma } from "./prisma";

// Пересчёт % посещаемости учеников.
// Пропуск по уважительной причине не считается прогулом и в знаменатель не входит —
// иначе болезнь портила бы показатель так же, как прогул.
// Два агрегата на всю группу вместо запроса на каждого ученика.
export async function recalcAttendance(studentIds: string[]) {
  const ids = [...new Set(studentIds)].filter(Boolean);
  if (ids.length === 0) return;

  const [counted, present] = await Promise.all([
    prisma.attendance.groupBy({
      by: ["studentId"],
      where: { studentId: { in: ids }, NOT: { present: false, excused: true } },
      _count: { _all: true },
    }),
    prisma.attendance.groupBy({
      by: ["studentId"],
      where: { studentId: { in: ids }, present: true },
      _count: { _all: true },
    }),
  ]);
  const totalBy = new Map(counted.map((r) => [r.studentId, r._count._all]));
  const presentBy = new Map(present.map((r) => [r.studentId, r._count._all]));

  await prisma.$transaction(
    ids.map((id) => {
      const total = totalBy.get(id) ?? 0;
      const pct = total > 0 ? Math.round(((presentBy.get(id) ?? 0) / total) * 100) : null;
      return prisma.student.update({ where: { id }, data: { attendance: pct } });
    })
  );
}
