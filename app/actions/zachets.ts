"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData } from "@/lib/access";
import { isCuratorOfGroup } from "@/lib/curator";
import { logAudit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { schoolDateTimeToUtc } from "@/lib/zachet";
import { UserError, asResult, str } from "./_shared";

// ---------- Зачёты ----------
// Ведёт куратор группы; админ и менеджер — тоже (подменить куратора, исправить ошибку).
async function assertCanManageZachets(groupId: string) {
  const session = await auth();
  if (!session?.user) throw new UserError("Требуется вход");
  if (await canEditData(session.user.role)) return session;
  if (await isCuratorOfGroup(session.user.id, groupId)) return session;
  throw new UserError("Зачёты этой группы ведёт её куратор");
}

async function zachetFields(formData: FormData) {
  const topic = str(formData.get("topic"));
  if (!topic) throw new UserError("Укажите тему зачёта");
  const tz = (await getSettings()).tzOffsetHours;
  const scheduledAt = schoolDateTimeToUtc(str(formData.get("date")), str(formData.get("time")), tz);
  if (!scheduledAt) throw new UserError("Укажите дату и время зачёта");
  return { topic, scheduledAt, note: str(formData.get("note")) || null };
}

const revalidateZachets = (id?: string) => {
  revalidatePath("/zachets");
  if (id) revalidatePath(`/zachets/${id}`);
  revalidatePath("/cabinet");
};

export async function createZachet(formData: FormData) {
  return asResult(async () => {
    const groupId = str(formData.get("groupId"));
    if (!groupId) throw new UserError("Выберите группу");
    const session = await assertCanManageZachets(groupId);
    const data = await zachetFields(formData);
    const z = await prisma.zachet.create({ data: { groupId, ...data, createdBy: session.user?.name ?? null } });
    await logAudit("CREATE", "Зачёт", data.topic);
    revalidateZachets(z.id);
  });
}

export async function updateZachet(id: string, formData: FormData) {
  return asResult(async () => {
    const z = await prisma.zachet.findUnique({ where: { id }, select: { groupId: true } });
    if (!z) throw new UserError("Зачёт не найден");
    await assertCanManageZachets(z.groupId);
    const data = await zachetFields(formData);
    await prisma.zachet.update({ where: { id }, data });
    await logAudit("UPDATE", "Зачёт", data.topic);
    revalidateZachets(id);
  });
}

export async function deleteZachet(id: string) {
  return asResult(async () => {
    const z = await prisma.zachet.findUnique({ where: { id }, select: { groupId: true, topic: true } });
    if (!z) return;
    await assertCanManageZachets(z.groupId);
    await prisma.zachet.delete({ where: { id } });
    await logAudit("DELETE", "Зачёт", z.topic);
    revalidateZachets();
  });
}

// Отметка ученика: true — сдал, false — не сдал, null — снять отметку.
export async function setZachetResult(zachetId: string, studentId: string, passed: boolean | null, comment?: string) {
  return asResult(async () => {
    const z = await prisma.zachet.findUnique({ where: { id: zachetId }, select: { groupId: true } });
    if (!z) throw new UserError("Зачёт не найден");
    const session = await assertCanManageZachets(z.groupId);
    // только ученики этой группы — чтобы по чужому id нельзя было поставить отметку
    const inGroup = await prisma.group.count({ where: { id: z.groupId, students: { some: { id: studentId } } } });
    if (!inGroup) throw new UserError("Ученик не из этой группы");

    if (passed === null) {
      await prisma.zachetResult.deleteMany({ where: { zachetId, studentId } });
    } else {
      const data = { passed, comment: comment?.trim() || null, markedBy: session.user?.name ?? null, markedAt: new Date() };
      await prisma.zachetResult.upsert({
        where: { zachetId_studentId: { zachetId, studentId } },
        create: { zachetId, studentId, ...data },
        update: data,
      });
    }
    revalidateZachets(zachetId);
  });
}
