"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { normalizePhoneOrNull } from "@/lib/phone";
import { assertEditor, int, newToken, str } from "./_shared";
import { invalidatePackageAlerts } from "@/lib/reminders";

// ---------- Ученики ----------
export async function createStudent(formData: FormData) {
  await assertEditor();
  const created = await prisma.student.create({
    data: {
      name: str(formData.get("name")),
      grade: str(formData.get("grade")) || null,
      phone: normalizePhoneOrNull(str(formData.get("phone"))),
      parentName: str(formData.get("parentName")) || null,
      parentPhone: normalizePhoneOrNull(str(formData.get("parentPhone"))),
      groups: { connect: formData.getAll("groups").map((v) => String(v)).filter(Boolean).map((id) => ({ id })) },
      status: str(formData.get("status")) || "ACTIVE",
      personalDiscount: Math.min(100, Math.max(0, int(formData.get("personalDiscount")))),
      // attendance намеренно не задаём: показатель появится после первой отметки посещаемости
      portalToken: newToken(),
    },
  });
  await logAudit("CREATE", "Ученик", created.name);
  revalidatePath("/students");
  invalidatePackageAlerts(); // группы/статус ученика влияют на «заканчиваются занятия»
  revalidatePath("/dashboard");
}

// Баланс не редактируется вручную — считается из оплат (recalcBalance).
export async function updateStudent(id: string, formData: FormData) {
  await assertEditor();
  await prisma.student.update({
    where: { id },
    data: {
      name: str(formData.get("name")),
      grade: str(formData.get("grade")) || null,
      phone: normalizePhoneOrNull(str(formData.get("phone"))),
      parentName: str(formData.get("parentName")) || null,
      parentPhone: normalizePhoneOrNull(str(formData.get("parentPhone"))),
      groups: { set: formData.getAll("groups").map((v) => String(v)).filter(Boolean).map((id) => ({ id })) },
      status: str(formData.get("status")) || "ACTIVE",
      personalDiscount: Math.min(100, Math.max(0, int(formData.get("personalDiscount")))),
    },
  });
  await logAudit("UPDATE", "Ученик", str(formData.get("name")));
  revalidatePath("/students");
  invalidatePackageAlerts(); // группы/статус ученика влияют на «заканчиваются занятия»
  revalidatePath(`/students/${id}`);
}

export async function unlinkTelegram(id: string) {
  await assertEditor();
  await prisma.student.update({ where: { id }, data: { telegramChatId: null } });
  revalidatePath(`/students/${id}`);
}

// Перевыпуск ссылки-приглашения в кабинет: старая ссылка перестаёт работать,
// привязка к Telegram сбрасывается (ученик сможет войти заново по новой ссылке).
export async function regenerateJoinToken(id: string) {
  await assertEditor();
  const student = await prisma.student.update({
    where: { id },
    data: { joinToken: newToken(), joinTgId: null },
    select: { name: true },
  });
  await logAudit("UPDATE", "Ученик", `Перевыпущена ссылка в кабинет · ${student.name}`);
  revalidatePath(`/students/${id}`);
}

// Перевыпуск постоянной ссылки родителя: старая перестаёт работать.
export async function regeneratePortalToken(id: string) {
  await assertEditor();
  const student = await prisma.student.update({
    where: { id },
    data: { portalToken: newToken() },
    select: { name: true },
  });
  await logAudit("UPDATE", "Ученик", `Перевыпущена ссылка родителя · ${student.name}`);
  revalidatePath(`/students/${id}`);
}

// Ученик уходит из школы: статус «Ушёл» и выход из групп. Все данные —
// оплаты, оценки, посещаемость — остаются на месте. Это замена удалению:
// удаление уносит их каскадом и восстанавливается только из снимка базы.
export async function archiveStudent(id: string) {
  await assertEditor();
  const st = await prisma.student.findUnique({
    where: { id },
    select: { name: true, groups: { select: { id: true } } },
  });
  if (!st) throw new Error("Ученик не найден");
  await prisma.student.update({
    where: { id },
    data: { status: "LEFT", groups: { disconnect: st.groups.map((g) => ({ id: g.id })) } },
  });
  await logAudit("UPDATE", "Ученик", `${st.name} — в архив (вышел из групп)`);
  revalidatePath("/students");
  invalidatePackageAlerts(); // группы/статус ученика влияют на «заканчиваются занятия»
  revalidatePath(`/students/${id}`);
}

export async function unarchiveStudent(id: string) {
  await assertEditor();
  const st = await prisma.student.findUnique({ where: { id }, select: { name: true } });
  if (!st) throw new Error("Ученик не найден");
  await prisma.student.update({ where: { id }, data: { status: "ACTIVE" } });
  await logAudit("UPDATE", "Ученик", `${st.name} — возвращён из архива`);
  revalidatePath("/students");
  invalidatePackageAlerts(); // группы/статус ученика влияют на «заканчиваются занятия»
  revalidatePath(`/students/${id}`);
}

// Удаление необратимо и уносит каскадом оплаты, оценки и посещаемость,
// поэтому доступно только администратору. Менеджеру — архив.
export async function deleteStudent(id: string) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Удалять учеников может только администратор. Используйте «В архив».");
  }
  const st = await prisma.student.findUnique({ where: { id }, select: { name: true } });
  await prisma.student.delete({ where: { id } });
  await logAudit("DELETE", "Ученик", st?.name ?? id);
  revalidatePath("/students");
  invalidatePackageAlerts(); // группы/статус ученика влияют на «заканчиваются занятия»
}
