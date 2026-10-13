"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { getSettings, renderTemplate, DEFAULT_TEMPLATES } from "@/lib/settings";
import { notifyParents, notifyStudentsDirect, studentIdsOfGroup } from "@/lib/notify";
import { getStudentIdForUser } from "@/lib/teacher";
import { assertCanManageGroup, parseDate, str } from "./_shared";

// ---------- Домашние задания ----------
export async function addHomework(groupId: string, formData: FormData) {
  const session = await assertCanManageGroup(groupId);
  await prisma.homework.create({
    data: {
      groupId,
      title: str(formData.get("title")) || "Домашнее задание",
      description: str(formData.get("description")) || null,
      dueDate: parseDate(formData.get("dueDate")),
      createdBy: session.user?.name ?? null,
    },
  });
  await logAudit("CREATE", "Домашнее задание", str(formData.get("title")));

  const stH = await getSettings();
  if (stH.notifyHomework) {
    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { name: true } });
    const due = parseDate(formData.get("dueDate"));
    const ids = await studentIdsOfGroup(groupId);
    const hwText = renderTemplate(stH.tplHomework || DEFAULT_TEMPLATES.homework, {
      school: stH.schoolName,
      group: group?.name ?? "",
      title: str(formData.get("title")) || "Домашнее задание",
      due: due ? `, срок: ${due.toLocaleDateString("ru-RU")}` : "",
    });
    await notifyParents(ids, hwText);
    if (stH.notifyStudent) await notifyStudentsDirect(ids, hwText);
  }

  revalidatePath("/homework");
}

export async function deleteHomework(id: string) {
  const hw = await prisma.homework.findUnique({ where: { id } });
  if (!hw) return;
  await assertCanManageGroup(hw.groupId);
  await prisma.homework.delete({ where: { id } });
  await logAudit("DELETE", "Домашнее задание", hw.title);
  revalidatePath("/homework");
}

export async function toggleHomeworkDone(homeworkId: string, studentId: string) {
  const hw = await prisma.homework.findUnique({ where: { id: homeworkId } });
  if (!hw) return;
  await assertCanManageGroup(hw.groupId);
  const existing = await prisma.homeworkDone.findUnique({
    where: { homeworkId_studentId: { homeworkId, studentId } },
  });
  if (existing) {
    await prisma.homeworkDone.update({ where: { id: existing.id }, data: { done: !existing.done } });
  } else {
    await prisma.homeworkDone.create({ data: { homeworkId, studentId, done: true } });
  }
  revalidatePath("/homework");
}

// Ученик убирает прикреплённую работу (например, чтобы приложить другую).
export async function removeMyHomeworkFile(homeworkId: string) {
  const session = await auth();
  const studentId = await getStudentIdForUser(session?.user?.id);
  if (!studentId) throw new Error("Профиль ученика не найден");
  await prisma.homeworkDone.updateMany({
    where: { homeworkId, studentId },
    data: { fileUrl: null, fileName: null, comment: null, submittedAt: null },
  });
  revalidatePath("/cabinet");
}

// Ученик отмечает/снимает выполнение СВОЕГО задания (studentId берётся из сессии).
export async function toggleMyHomework(homeworkId: string): Promise<{ done: boolean }> {
  const session = await auth();
  const studentId = await getStudentIdForUser(session?.user?.id);
  if (!studentId) throw new Error("Профиль ученика не найден");

  const hw = await prisma.homework.findUnique({ where: { id: homeworkId }, select: { groupId: true } });
  if (!hw) throw new Error("Задание не найдено");

  // Задание должно относиться к одной из групп ученика
  const inGroup = await prisma.student.findFirst({
    where: { id: studentId, groups: { some: { id: hw.groupId } } },
    select: { id: true },
  });
  if (!inGroup) throw new Error("Недостаточно прав");

  const existing = await prisma.homeworkDone.findUnique({
    where: { homeworkId_studentId: { homeworkId, studentId } },
  });
  let done: boolean;
  if (existing) {
    done = !existing.done;
    await prisma.homeworkDone.update({ where: { id: existing.id }, data: { done } });
  } else {
    done = true;
    await prisma.homeworkDone.create({ data: { homeworkId, studentId, done } });
  }
  revalidatePath("/cabinet");
  return { done };
}
