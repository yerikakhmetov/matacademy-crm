"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData } from "@/lib/access";
import { logAudit } from "@/lib/audit";

// ---------- Учебные материалы ----------
export async function deleteMaterial(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Требуется вход");
  const m = await prisma.material.findUnique({ where: { id }, include: { group: { include: { teacher: true } } } });
  if (!m) return;
  const owns = m.group?.teacher?.userId === session.user.id;
  if (!await canEditData(session.user.role) && !(session.user.role === "TEACHER" && owns)) throw new Error("Недостаточно прав");
  await prisma.material.delete({ where: { id } });
  await logAudit("DELETE", "Материал", m.title);
  revalidatePath("/materials");
  revalidatePath("/schedule");
}
