"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { assertAdmin, int, parseDate, str } from "./_shared";

// ---------- Промокоды ----------
function normPromo(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export async function createPromo(formData: FormData) {
  await assertAdmin();
  const code = normPromo(str(formData.get("code")));
  if (!code) throw new Error("Введите код");
  const percent = Math.min(100, Math.max(1, int(formData.get("percent"))));
  const maxUses = Math.max(0, int(formData.get("maxUses")));
  const note = str(formData.get("note")) || null;
  const expiresAt = parseDate(formData.get("expiresAt"));
  await prisma.promoCode.upsert({
    where: { code },
    create: { code, percent, maxUses, note, expiresAt },
    update: { percent, maxUses, note, expiresAt, active: true },
  });
  await logAudit("CREATE", "Промокод", code);
  revalidatePath("/settings");
}

export async function togglePromo(id: string) {
  await assertAdmin();
  const p = await prisma.promoCode.findUnique({ where: { id }, select: { active: true, code: true } });
  if (!p) return;
  await prisma.promoCode.update({ where: { id }, data: { active: !p.active } });
  await logAudit("UPDATE", "Промокод", p.code);
  revalidatePath("/settings");
}

export async function deletePromo(id: string) {
  await assertAdmin();
  const p = await prisma.promoCode.findUnique({ where: { id }, select: { code: true } });
  await prisma.promoCode.delete({ where: { id } });
  await logAudit("DELETE", "Промокод", p?.code ?? id);
  revalidatePath("/settings");
}

// Очистка всех данных (кроме логинов и настроек). Только для администратора.
export async function clearAllData(confirm: string) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Только для администратора");
  if (confirm !== "ОЧИСТИТЬ") throw new Error("Подтверждение не совпадает");

  await prisma.student.deleteMany(); // каскадом: оплаты, абонементы, посещаемость, оценки
  await prisma.lesson.deleteMany();
  await prisma.lead.deleteMany(); // каскадом: активности лидов
  await prisma.group.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.auditLog.deleteMany();
  await logAudit("DELETE", "База данных", `Полная очистка данных (${session.user?.name ?? "админ"})`);

  revalidatePath("/", "layout");
}
