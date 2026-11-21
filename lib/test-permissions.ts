import { prisma } from "@/lib/prisma";
import { canEditData } from "@/lib/access";
import { canTeacherManageTest } from "@/lib/test-policy";

export async function teacherTestScope(userId: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: { subjects: { select: { id: true } }, groups: { select: { id: true, subjectId: true } } },
  });
  return {
    subjectIds: [...new Set([
      ...(teacher?.subjects.map((subject) => subject.id) ?? []),
      ...(teacher?.groups.map((group) => group.subjectId).filter((id): id is string => !!id) ?? []),
    ])],
    ownGroupIds: teacher?.groups.map((group) => group.id) ?? [],
  };
}

export async function assertTestManager(test: { subjectId: string | null; groupId: string | null }) {
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user) throw new Error("Требуется вход");
  if (await canEditData(session.user.role)) return { editor: true, scope: null };
  if (session.user.role !== "TEACHER" || !session.user.id) throw new Error("Недостаточно прав");
  const scope = await teacherTestScope(session.user.id);
  if (!canTeacherManageTest(test, scope)) throw new Error("Недостаточно прав для этого предмета");
  return { editor: false, scope };
}

export async function assertTestGroupsForSubject(groupIds: string[], subjectId: string) {
  const count = await prisma.group.count({ where: { id: { in: groupIds }, subjectId } });
  if (count !== groupIds.length) throw new Error("Можно выбрать только группы предмета теста");
}
