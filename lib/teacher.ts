import { prisma } from "./prisma";

// Id преподавателя, привязанного к пользователю (или null).
export async function getTeacherIdForUser(userId?: string | null): Promise<string | null> {
  if (!userId) return null;
  const t = await prisma.teacher.findUnique({ where: { userId }, select: { id: true } });
  return t?.id ?? null;
}

export function isTeacher(role?: string | null): boolean {
  return role === "TEACHER";
}
