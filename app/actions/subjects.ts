"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { assertEditor, int, str } from "./_shared";

// ---------- Предметы ----------
export async function createSubject(formData: FormData) {
  await assertEditor();
  const name = str(formData.get("name"));
  if (!name) throw new Error("Укажите название предмета");
  await prisma.subject.create({
    data: {
      name,
      price: int(formData.get("price")),
      lessonsPerMonth: Math.max(0, int(formData.get("lessonsPerMonth"))),
      teacherRate: Math.max(0, int(formData.get("teacherRate"))),
      teacherRateLessons: Math.max(1, int(formData.get("teacherRateLessons")) || 12),
      curatorRate: Math.max(0, int(formData.get("curatorRate"))),
      color: str(formData.get("color")) || "#3A5AE0",
      active: formData.get("active") != null,
    },
  });
  await logAudit("CREATE", "Предмет", name);
  revalidatePath("/subjects");
}

export async function updateSubject(id: string, formData: FormData) {
  await assertEditor();
  const name = str(formData.get("name"));
  await prisma.subject.update({
    where: { id },
    data: {
      name,
      price: int(formData.get("price")),
      lessonsPerMonth: Math.max(0, int(formData.get("lessonsPerMonth"))),
      teacherRate: Math.max(0, int(formData.get("teacherRate"))),
      teacherRateLessons: Math.max(1, int(formData.get("teacherRateLessons")) || 12),
      curatorRate: Math.max(0, int(formData.get("curatorRate"))),
      color: str(formData.get("color")) || "#3A5AE0",
      active: formData.get("active") != null,
    },
  });
  await logAudit("UPDATE", "Предмет", name);
  revalidatePath("/subjects");
}

export async function deleteSubject(id: string) {
  await assertEditor();
  const s = await prisma.subject.findUnique({ where: { id }, select: { name: true } });
  await prisma.subject.delete({ where: { id } });
  await logAudit("DELETE", "Предмет", s?.name ?? id);
  revalidatePath("/subjects");
}
