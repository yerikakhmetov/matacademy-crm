"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { MANAGER_PERMS } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { tariffsFromText, isDiscountMode } from "@/lib/settings";
import { isLocale } from "@/lib/i18n";
import { int } from "./_shared";

// ---------- Настройки школы ----------
export async function updateSettings(formData: FormData) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Только для администратора");
  const tariffs = tariffsFromText(String(formData.get("tariffs") ?? ""));
  const data = {
    schoolName: String(formData.get("schoolName") ?? "").trim() || "МатАкадемия",
    address: String(formData.get("address") ?? "").trim(),
    branches: String(formData.get("branches") ?? "").trim() || "Абая",
    rooms: String(formData.get("rooms") ?? "").trim() || "Каб. 1",
    tariffs: JSON.stringify(tariffs),
    tplOverdue: String(formData.get("tplOverdue") ?? "").trim(),
    tplPending: String(formData.get("tplPending") ?? "").trim(),
    tplExpiring: String(formData.get("tplExpiring") ?? "").trim(),
    // чекбокс "perm_<key>" присутствует = разрешено; отсутствует = запрещено
    managerDenied: MANAGER_PERMS.filter((p) => !formData.get(`perm_${p.key}`)).map((p) => p.key).join(","),
    discounts: String(formData.get("discounts") ?? "").trim(),
    multiDiscount: String(formData.get("multiDiscount") ?? "").trim(),
    discountMode: isDiscountMode(String(formData.get("discountMode"))) ? String(formData.get("discountMode")) : "add",
    siblingDiscount: Math.min(100, Math.max(0, int(formData.get("siblingDiscount")))),
    schoolFeePct: Math.min(100, Math.max(0, int(formData.get("schoolFeePct")))),
    curatorRate: Math.max(0, int(formData.get("curatorRate"))),
    tzOffsetHours: Math.min(14, Math.max(-12, int(formData.get("tzOffsetHours")))),
    defaultLocale: isLocale(String(formData.get("defaultLocale"))) ? String(formData.get("defaultLocale")) : "ru",
    notifyGrade: formData.get("notifyGrade") != null,
    notifyHomework: formData.get("notifyHomework") != null,
    notifyCancel: formData.get("notifyCancel") != null,
    tplGrade: String(formData.get("tplGrade") ?? "").trim(),
    tplHomework: String(formData.get("tplHomework") ?? "").trim(),
    tplCancel: String(formData.get("tplCancel") ?? "").trim(),
    notifyStudent: formData.get("notifyStudent") != null,
    lessonDurationMin: Math.min(600, Math.max(5, int(formData.get("lessonDurationMin")) || 60)),
  };
  await prisma.settings.upsert({ where: { id: "main" }, update: data, create: { id: "main", ...data } });
  await logAudit("UPDATE", "Настройки", "Параметры школы обновлены");
  revalidatePath("/settings");
  revalidatePath("/", "layout");
}
