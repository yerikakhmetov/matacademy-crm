// Общие помощники серверных экшенов: проверки прав, разбор FormData, ошибки для форм.
// НЕ "use server": отсюда ничего не вызывается из браузера напрямую.

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData, getAccess, type PermKey } from "@/lib/access";
import { recalc } from "@/lib/overdue";
import { getSettings } from "@/lib/settings";
import { schoolToday } from "@/lib/school-time";

export async function assertAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Только для администратора");
  return session;
}

export async function assertEditor(module?: PermKey) {
  const { session, can } = await getAccess();
  if (!session?.user) throw new Error("Требуется вход");
  if (!can("edit")) throw new Error("Недостаточно прав");
  if (module && !can(module)) throw new Error("Недостаточно прав для этого раздела");
}

export const str = (v: FormDataEntryValue | null) => (v == null ? "" : String(v).trim());

export const newToken = () => crypto.randomUUID().replace(/-/g, "");

export const int = (v: FormDataEntryValue | null) => {
  const n = parseInt(String(v ?? "").replace(/\s/g, ""), 10);
  return isNaN(n) ? 0 : n;
};

// Пересчёт задолженности ученика: долг = сумма неоплаченных счетов (PENDING + OVERDUE).
// Баланс считается из оплат — логика в lib/overdue (recalc). Здесь только внутренние вызовы.

export const parseDate = (v: FormDataEntryValue | null) => {
  const s = str(v);
  return s ? new Date(s + "T00:00:00.000Z") : null;
};

// Дата из формы, а если её не указали — сегодня по часам школы (UTC-полночью).
// Просто new Date() на сервере в UTC ночью 1-го числа дал бы прошлый месяц.
export async function dateOrToday(v: FormDataEntryValue | null): Promise<Date> {
  return parseDate(v) ?? schoolToday((await getSettings()).tzOffsetHours);
}

export async function assertCanManageGroup(groupId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Требуется вход");
  if (await canEditData(session.user.role)) return session;
  const group = await prisma.group.findUnique({ where: { id: groupId }, include: { teacher: true } });
  if (session.user.role === "TEACHER" && group?.teacher?.userId === session.user.id) return session;
  throw new Error("Недостаточно прав");
}

// Ученик действительно в этой группе. Права на группу проверяются отдельно, но без этой
// проверки преподаватель своей группы мог бы ставить отметки чужому ученику по его id.
export async function assertStudentInGroup(studentId: string, groupId: string) {
  const n = await prisma.group.count({ where: { id: groupId, students: { some: { id: studentId } } } });
  if (n === 0) throw new Error("Ученик не из этой группы");
}

// Ошибка, которую должен увидеть пользователь. Брошенный текст в продакшне до браузера
// не доходит, поэтому формы получают его как результат: { error }.
export class UserError extends Error {}

export async function asResult(run: () => Promise<unknown>): Promise<{ error?: string } | void> {
  try {
    await run();
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
}
