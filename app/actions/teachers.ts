"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { normalizePhoneOrNull } from "@/lib/phone";
import { assertEditor, str } from "./_shared";

// ---------- Учителя ----------
export async function createTeacher(formData: FormData) {
  await assertEditor("teachers");
  const subjectIds = formData.getAll("subjects").map((v) => String(v)).filter(Boolean);
  await prisma.teacher.create({
    data: {
      name: str(formData.get("name")),
      specialty: str(formData.get("specialty")),
      phone: normalizePhoneOrNull(str(formData.get("phone"))),
      color: str(formData.get("color")) || "#3A5AE0",
      subjects: subjectIds.length ? { connect: subjectIds.map((id) => ({ id })) } : undefined,
    },
  });
  await logAudit("CREATE", "Преподаватель", str(formData.get("name")));
  revalidatePath("/teachers");
}

export async function updateTeacher(id: string, formData: FormData) {
  await assertEditor("teachers");
  const subjectIds = formData.getAll("subjects").map((v) => String(v)).filter(Boolean);
  await prisma.teacher.update({
    where: { id },
    data: {
      name: str(formData.get("name")),
      specialty: str(formData.get("specialty")),
      phone: normalizePhoneOrNull(str(formData.get("phone"))),
      color: str(formData.get("color")) || "#3A5AE0",
      subjects: { set: subjectIds.map((id) => ({ id })) },
    },
  });
  await logAudit("UPDATE", "Преподаватель", str(formData.get("name")));
  revalidatePath("/teachers");
  revalidatePath("/payroll");
}

export async function deleteTeacher(id: string) {
  await assertEditor("teachers");
  const t = await prisma.teacher.findUnique({ where: { id }, select: { name: true } });
  await prisma.teacher.delete({ where: { id } }); // группы открепляются (teacherId -> null)
  await logAudit("DELETE", "Преподаватель", t?.name ?? id);
  revalidatePath("/teachers");
  revalidatePath("/groups");
}

// Изменить ставку преподавателя
