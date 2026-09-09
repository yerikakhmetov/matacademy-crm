import { prisma } from "./prisma";

// Куратор ведёт не занятия, а группы: следит за посещаемостью и журналом.
// Видит только те группы, которые за ним закреплены.
export function isCurator(role?: string | null): boolean {
  return role === "CURATOR";
}

// Id групп куратора. Пустой список — куратор без групп: он не должен
// увидеть школу целиком, поэтому вызывающий код подставляет заглушку.
export async function curatorGroupIds(userId?: string | null): Promise<string[]> {
  if (!userId) return [];
  const groups = await prisma.group.findMany({ where: { curatorId: userId }, select: { id: true } });
  return groups.map((g) => g.id);
}

// Условие `where` по группам куратора; "__none__" гарантирует пустую выборку.
export function groupScope(ids: string[]): { in: string[] } {
  return { in: ids.length > 0 ? ids : ["__none__"] };
}

// Может ли пользователь отмечать посещаемость этой группы.
export async function isCuratorOfGroup(userId: string | null | undefined, groupId: string): Promise<boolean> {
  if (!userId) return false;
  const g = await prisma.group.findFirst({ where: { id: groupId, curatorId: userId }, select: { id: true } });
  return g != null;
}

// Единое условие выборки групп по роли: преподаватель видит свои,
// куратор — закреплённые за ним, остальные (админ/менеджер) — все.
export function groupWhereFor(o: {
  teacher: boolean;
  teacherId?: string | null;
  curator: boolean;
  groupIds?: string[];
}): Record<string, unknown> {
  if (o.teacher) return { teacherId: o.teacherId ?? "__none__" };
  if (o.curator) return { id: groupScope(o.groupIds ?? []) };
  return {};
}
