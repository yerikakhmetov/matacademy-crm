"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { normalizePhoneOrNull } from "@/lib/phone";
import bcrypt from "bcryptjs";
import { assertAdmin, newToken } from "./_shared";

// ---------- Пользователи ----------
export async function createUser(formData: FormData) {
  await assertAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "MANAGER");
  if (!email || !password || !name) throw new Error("Заполните имя, email и пароль");
  if (password.length < 6) throw new Error("Пароль минимум 6 символов");
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new Error("Пользователь с таким email уже есть");
  await prisma.user.create({ data: { email, name, role, passwordHash: bcrypt.hashSync(password, 10) } });
  await logAudit("CREATE", "Пользователь", `${name} (${role})`);
  revalidatePath("/users");
}

// Выдать одноразовый код привязки Telegram к учётной записи.
export async function issueTelegramBind(userId: string) {
  await assertAdmin();
  const user = await prisma.user.update({
    where: { id: userId },
    data: { tgBindToken: newToken(), tgBindIssued: new Date() },
    select: { name: true },
  });
  await logAudit("UPDATE", "Пользователь", `Выдан код привязки Telegram · ${user.name}`);
  revalidatePath("/users");
}

// Отвязать Telegram: вход по кнопке для этой учётной записи перестаёт работать.
export async function unbindTelegram(userId: string) {
  await assertAdmin();
  const user = await prisma.user.update({
    where: { id: userId },
    data: { telegramUserId: null, tgBindToken: null, tgBindIssued: null },
    select: { name: true },
  });
  await logAudit("UPDATE", "Пользователь", `Telegram отвязан · ${user.name}`);
  revalidatePath("/users");
}

// Разовое обслуживание: привести уже накопленные телефоны к виду +7 (XXX) XXX-XX-XX.
// Новые записи сохраняются приведёнными сами, а старые лежат кто как — из-за
// этого, в частности, не срабатывала скидка «брат/сестра» (родитель ищется
// по точному совпадению parentPhone).
export async function normalizeAllPhones(): Promise<{ changed: number; checked: number }> {
  await assertAdmin();

  const [students, teachers, leads] = await Promise.all([
    prisma.student.findMany({ select: { id: true, phone: true, parentPhone: true } }),
    prisma.teacher.findMany({ select: { id: true, phone: true } }),
    prisma.lead.findMany({ select: { id: true, phone: true } }),
  ]);

  let changed = 0;
  const checked = students.length * 2 + teachers.length + leads.length;

  for (const st of students) {
    const phone = normalizePhoneOrNull(st.phone);
    const parentPhone = normalizePhoneOrNull(st.parentPhone);
    const data: { phone?: string | null; parentPhone?: string | null } = {};
    if (phone !== st.phone) data.phone = phone;
    if (parentPhone !== st.parentPhone) data.parentPhone = parentPhone;
    if (Object.keys(data).length > 0) {
      await prisma.student.update({ where: { id: st.id }, data });
      changed += Object.keys(data).length;
    }
  }
  for (const t of teachers) {
    const phone = normalizePhoneOrNull(t.phone);
    if (phone !== t.phone) {
      await prisma.teacher.update({ where: { id: t.id }, data: { phone } });
      changed++;
    }
  }
  for (const l of leads) {
    const phone = normalizePhoneOrNull(l.phone);
    if (phone !== l.phone) {
      await prisma.lead.update({ where: { id: l.id }, data: { phone } });
      changed++;
    }
  }

  await logAudit("UPDATE", "Настройки", `Телефоны приведены к единому виду · исправлено ${changed}`);
  revalidatePath("/students");
  revalidatePath("/teachers");
  revalidatePath("/leads");
  return { changed, checked };
}

export async function updateUser(id: string, formData: FormData) {
  await assertAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "MANAGER");
  const password = String(formData.get("password") ?? "");
  const data: { name: string; role: string; passwordHash?: string } = { name, role };
  if (password) {
    if (password.length < 6) throw new Error("Пароль минимум 6 символов");
    data.passwordHash = bcrypt.hashSync(password, 10);
  }
  await prisma.user.update({ where: { id }, data });
  await logAudit("UPDATE", "Пользователь", `${name}${password ? " (пароль изменён)" : ""}`);
  revalidatePath("/users");
}

export async function deleteUser(id: string) {
  const session = await assertAdmin();
  if (session.user?.id === id) throw new Error("Нельзя удалить свою учётную запись");
  const admins = await prisma.user.count({ where: { role: "ADMIN" } });
  const target = await prisma.user.findUnique({ where: { id }, select: { name: true, role: true } });
  if (target?.role === "ADMIN" && admins <= 1) throw new Error("Нельзя удалить единственного администратора");
  await prisma.user.delete({ where: { id } });
  await logAudit("DELETE", "Пользователь", target?.name ?? id);
  revalidatePath("/users");
}
