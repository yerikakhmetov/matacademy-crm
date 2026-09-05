import { prisma } from "./prisma";
import { sendTelegram } from "./telegram";

// Автоуведомления родителям в Telegram.
// Рассылка «тихая»: если бот не настроен или чат недоступен, действие
// преподавателя (оценка, ДЗ, отмена занятия) всё равно должно пройти.

export async function notifyParents(studentIds: string[], text: string): Promise<number> {
  if (studentIds.length === 0 || !text.trim()) return 0;
  try {
    const students = await prisma.student.findMany({
      where: { id: { in: studentIds }, telegramChatId: { not: null } },
      select: { telegramChatId: true },
    });
    const results = await Promise.allSettled(
      students.map((s) => sendTelegram(s.telegramChatId as string, text))
    );
    return results.filter((r) => r.status === "fulfilled" && r.value).length;
  } catch {
    return 0;
  }
}

export async function notifyParent(studentId: string, text: string): Promise<boolean> {
  return (await notifyParents([studentId], text)) > 0;
}

// Ученики группы — для рассылок про ДЗ и отменённые занятия.
export async function studentIdsOfGroup(groupId: string): Promise<string[]> {
  const g = await prisma.group.findUnique({ where: { id: groupId }, select: { students: { select: { id: true } } } });
  return g?.students.map((s) => s.id) ?? [];
}

// Уведомление самому ученику в его Telegram (id сохраняется при входе в кабинет).
// Родителю пишем всегда, ученику — только если школа включила дублирование.
export async function notifyStudentsDirect(studentIds: string[], text: string): Promise<number> {
  if (studentIds.length === 0 || !text.trim()) return 0;
  try {
    const students = await prisma.student.findMany({
      where: { id: { in: studentIds }, joinTgId: { not: null } },
      select: { joinTgId: true },
    });
    const results = await Promise.allSettled(
      students.map((s) => sendTelegram(s.joinTgId as string, text))
    );
    return results.filter((r) => r.status === "fulfilled" && r.value).length;
  } catch {
    return 0;
  }
}
