"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { UserError, asResult, assertEditor, int, str } from "./_shared";

// Занятий в месяц — размер пакета «месяца обучения»: от него цена занятия в зарплате
// и деление счёта между предметами. Пусто нельзя: раньше молча считалось 12,
// и обязательный предмет (8 занятий) оплачивался преподавателю дешевле.
function lessonsPerMonthFrom(formData: FormData): number {
  const n = int(formData.get("lessonsPerMonth"));
  if (n < 1 || n > 40) throw new UserError("Укажите, сколько занятий в месяце: выборный предмет — 12, обязательный — 8");
  return n;
}

// ---------- Предметы ----------
export async function createSubject(formData: FormData) {
  return asResult(() => createSubjectImpl(formData));
}

async function createSubjectImpl(formData: FormData) {
  await assertEditor();
  const name = str(formData.get("name"));
  if (!name) throw new UserError("Укажите название предмета");
  await prisma.subject.create({
    data: {
      name,
      price: int(formData.get("price")),
      lessonsPerMonth: lessonsPerMonthFrom(formData),
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
  return asResult(() => updateSubjectImpl(id, formData));
}

async function updateSubjectImpl(id: string, formData: FormData) {
  await assertEditor();
  const name = str(formData.get("name"));
  if (!name) throw new UserError("Укажите название предмета");
  await prisma.subject.update({
    where: { id },
    data: {
      name,
      price: int(formData.get("price")),
      lessonsPerMonth: lessonsPerMonthFrom(formData),
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
