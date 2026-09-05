"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData, MANAGER_PERMS, getAccess, type PermKey } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { money } from "@/lib/format";
import { tariffsFromText, getSettings, parseDiscounts, parseMultiTiers, multiPercentFor, computePricing, splitByPrice, isDiscountMode, renderTemplate, DEFAULT_TEMPLATES } from "@/lib/settings";
import { sendTelegram } from "@/lib/telegram";
import { notifyParent, notifyParents, studentIdsOfGroup } from "@/lib/notify";
import { recalc, markOverdue } from "@/lib/overdue";
import { recalcAttendance } from "@/lib/attendance";
import { maxRefundable, outstanding, paymentStatus } from "@/lib/payments";
import { gatherPayroll } from "@/lib/payroll";
import { getStudentIdForUser } from "@/lib/teacher";
import { isTestOpen } from "@/lib/tests";
import { isLocale } from "@/lib/i18n";
import bcrypt from "bcryptjs";

async function assertAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Только для администратора");
  return session;
}

// ---------- Пользователи (только админ) ----------
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

async function assertEditor(module?: PermKey) {
  const { session, can } = await getAccess();
  if (!session?.user) throw new Error("Требуется вход");
  if (!can("edit")) throw new Error("Недостаточно прав");
  if (module && !can(module)) throw new Error("Недостаточно прав для этого раздела");
}

// ---------- Фото профиля (Vercel Blob) ----------
async function assertCanEditPhoto(entity: "student" | "teacher", id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Требуется вход");
  if (await canEditData(session.user.role)) return;
  // учитель может менять только своё фото
  if (entity === "teacher" && session.user.role === "TEACHER") {
    const t = await prisma.teacher.findUnique({ where: { id }, select: { userId: true } });
    if (t?.userId === session.user.id) return;
  }
  throw new Error("Недостаточно прав");
}

// Сохранить URL фото (файл уже загружен напрямую в Vercel Blob с клиента).
export async function savePhotoUrl(entity: "student" | "teacher", id: string, url: string) {
  await assertCanEditPhoto(entity, id);
  if (!/^https:\/\/[^/]+\.blob\.vercel-storage\.com\//.test(url) && !/^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\//.test(url)) {
    throw new Error("Недопустимый адрес файла");
  }
  if (entity === "student") await prisma.student.update({ where: { id }, data: { photoUrl: url } });
  else await prisma.teacher.update({ where: { id }, data: { photoUrl: url } });

  revalidatePath(entity === "student" ? `/students/${id}` : "/teachers");
  revalidatePath("/my-students");
}

export async function removePhoto(entity: "student" | "teacher", id: string) {
  await assertCanEditPhoto(entity, id);
  if (entity === "student") await prisma.student.update({ where: { id }, data: { photoUrl: null } });
  else await prisma.teacher.update({ where: { id }, data: { photoUrl: null } });
  revalidatePath(entity === "student" ? `/students/${id}` : "/teachers");
  revalidatePath("/my-students");
}

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
}

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
    tzOffsetHours: Math.min(14, Math.max(-12, int(formData.get("tzOffsetHours")))),
    defaultLocale: isLocale(String(formData.get("defaultLocale"))) ? String(formData.get("defaultLocale")) : "ru",
    notifyGrade: formData.get("notifyGrade") != null,
    notifyHomework: formData.get("notifyHomework") != null,
    notifyCancel: formData.get("notifyCancel") != null,
    tplGrade: String(formData.get("tplGrade") ?? "").trim(),
    tplHomework: String(formData.get("tplHomework") ?? "").trim(),
    tplCancel: String(formData.get("tplCancel") ?? "").trim(),
  };
  await prisma.settings.upsert({ where: { id: "main" }, update: data, create: { id: "main", ...data } });
  await logAudit("UPDATE", "Настройки", "Параметры школы обновлены");
  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

// ---------- Промокоды (только админ) ----------
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

const str = (v: FormDataEntryValue | null) => (v == null ? "" : String(v).trim());
const newToken = () => crypto.randomUUID().replace(/-/g, "");
const int = (v: FormDataEntryValue | null) => {
  const n = parseInt(String(v ?? "").replace(/\s/g, ""), 10);
  return isNaN(n) ? 0 : n;
};

// Пересчёт задолженности ученика: долг = сумма неоплаченных счетов (PENDING + OVERDUE).
// Баланс считается из оплат — логика в lib/overdue (recalc). Здесь только внутренние вызовы.

// ---------- Ученики ----------
export async function createStudent(formData: FormData) {
  await assertEditor();
  const created = await prisma.student.create({
    data: {
      name: str(formData.get("name")),
      grade: str(formData.get("grade")) || null,
      phone: str(formData.get("phone")) || null,
      parentName: str(formData.get("parentName")) || null,
      parentPhone: str(formData.get("parentPhone")) || null,
      groups: { connect: formData.getAll("groups").map((v) => String(v)).filter(Boolean).map((id) => ({ id })) },
      status: str(formData.get("status")) || "ACTIVE",
      personalDiscount: Math.min(100, Math.max(0, int(formData.get("personalDiscount")))),
      // attendance намеренно не задаём: показатель появится после первой отметки посещаемости
      portalToken: newToken(),
    },
  });
  await logAudit("CREATE", "Ученик", created.name);
  revalidatePath("/students");
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
      phone: str(formData.get("phone")) || null,
      parentName: str(formData.get("parentName")) || null,
      parentPhone: str(formData.get("parentPhone")) || null,
      groups: { set: formData.getAll("groups").map((v) => String(v)).filter(Boolean).map((id) => ({ id })) },
      status: str(formData.get("status")) || "ACTIVE",
      personalDiscount: Math.min(100, Math.max(0, int(formData.get("personalDiscount")))),
    },
  });
  await logAudit("UPDATE", "Ученик", str(formData.get("name")));
  revalidatePath("/students");
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

export async function deleteStudent(id: string) {
  await assertEditor();
  const st = await prisma.student.findUnique({ where: { id }, select: { name: true } });
  await prisma.student.delete({ where: { id } });
  await logAudit("DELETE", "Ученик", st?.name ?? id);
  revalidatePath("/students");
}

// ---------- Группы ----------
export async function createGroup(formData: FormData) {
  await assertEditor();
  await prisma.group.create({
    data: {
      name: str(formData.get("name")),
      level: str(formData.get("level")),
      capacity: int(formData.get("capacity")) || 12,
      color: str(formData.get("color")) || "#3A5AE0",
      teacherId: str(formData.get("teacherId")) || null,
      subjectId: str(formData.get("subjectId")) || null,
    },
  });
  await logAudit("CREATE", "Группа", str(formData.get("name")));
  revalidatePath("/groups");
}

export async function updateGroup(id: string, formData: FormData) {
  await assertEditor();
  await prisma.group.update({
    where: { id },
    data: {
      name: str(formData.get("name")),
      level: str(formData.get("level")),
      capacity: int(formData.get("capacity")) || 12,
      color: str(formData.get("color")) || "#3A5AE0",
      teacherId: str(formData.get("teacherId")) || null,
      subjectId: str(formData.get("subjectId")) || null,
    },
  });
  await logAudit("UPDATE", "Группа", str(formData.get("name")));
  revalidatePath("/groups");
  revalidatePath("/schedule");
}

export async function deleteGroup(id: string) {
  await assertEditor();
  const g = await prisma.group.findUnique({ where: { id }, select: { name: true } });
  // ученики открепляются (groupId -> null), занятия удаляются каскадом
  await prisma.group.delete({ where: { id } });
  await logAudit("DELETE", "Группа", g?.name ?? id);
  revalidatePath("/groups");
  revalidatePath("/schedule");
}

// ---------- Учителя ----------
export async function createTeacher(formData: FormData) {
  await assertEditor("teachers");
  const subjectIds = formData.getAll("subjects").map((v) => String(v)).filter(Boolean);
  await prisma.teacher.create({
    data: {
      name: str(formData.get("name")),
      specialty: str(formData.get("specialty")),
      phone: str(formData.get("phone")) || null,
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
      phone: str(formData.get("phone")) || null,
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

// ---------- Лиды ----------
export async function createLead(formData: FormData) {
  await assertEditor("leads");
  await prisma.lead.create({
    data: {
      name: str(formData.get("name")),
      childName: str(formData.get("childName")) || null,
      phone: str(formData.get("phone")) || null,
      grade: str(formData.get("grade")) || null,
      subject: str(formData.get("subject")) || null,
      source: str(formData.get("source")) || null,
      trialDate: parseDate(formData.get("trialDate")),
      nextActionAt: parseDate(formData.get("nextActionAt")),
      stage: "NEW",
    },
  });
  await logAudit("CREATE", "Лид", str(formData.get("name")));
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

export async function moveLead(id: string, stage: string) {
  await assertEditor("leads");
  await prisma.lead.update({ where: { id }, data: { stage } });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/dashboard");
}

export async function updateLead(id: string, formData: FormData) {
  await assertEditor("leads");
  await prisma.lead.update({
    where: { id },
    data: {
      name: str(formData.get("name")),
      childName: str(formData.get("childName")) || null,
      phone: str(formData.get("phone")) || null,
      grade: str(formData.get("grade")) || null,
      subject: str(formData.get("subject")) || null,
      source: str(formData.get("source")) || null,
      trialDate: parseDate(formData.get("trialDate")),
      nextActionAt: parseDate(formData.get("nextActionAt")),
    },
  });
  await logAudit("UPDATE", "Лид", str(formData.get("name")));
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
}

export async function deleteLead(id: string) {
  await assertEditor("leads");
  const l = await prisma.lead.findUnique({ where: { id }, select: { name: true } });
  await prisma.lead.delete({ where: { id } });
  await logAudit("DELETE", "Лид", l?.name ?? id);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

const parseDate = (v: FormDataEntryValue | null) => {
  const s = str(v);
  return s ? new Date(s + "T00:00:00.000Z") : null;
};

// Активности по лиду (звонок / задача / заметка)
export async function addLeadActivity(leadId: string, formData: FormData) {
  await assertEditor("leads");
  const text = str(formData.get("text"));
  if (!text) throw new Error("Введите текст");
  await prisma.leadActivity.create({
    data: {
      leadId,
      type: str(formData.get("type")) || "NOTE",
      text,
      dueDate: parseDate(formData.get("dueDate")),
    },
  });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

export async function toggleLeadTask(activityId: string) {
  await assertEditor("leads");
  const a = await prisma.leadActivity.findUnique({ where: { id: activityId } });
  if (!a) return;
  await prisma.leadActivity.update({ where: { id: activityId }, data: { done: !a.done } });
  revalidatePath(`/leads/${a.leadId}`);
  revalidatePath("/leads");
}

// Перевод лида в ученики (создаёт ученика, помечает лид как «Оплатили»)
export async function convertLeadToStudent(leadId: string, formData: FormData) {
  await assertEditor("leads");
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Лид не найден");

  const newStudent = await prisma.student.create({
    data: {
      name: str(formData.get("name")) || lead.childName || lead.name,
      grade: str(formData.get("grade")) || lead.grade || null,
      groups: { connect: formData.getAll("groupId").map((v) => String(v)).filter(Boolean).map((id) => ({ id })) },
      phone: lead.phone,
      parentName: lead.name,
      parentPhone: lead.phone,
      status: "ACTIVE",
      attendance: 100,
      portalToken: newToken(),
    },
  });
  await logAudit("CREATE", "Ученик", `${newStudent.name} (из лида)`);
  await prisma.lead.update({ where: { id: leadId }, data: { stage: "WON" } });

  revalidatePath("/leads");
  revalidatePath("/students");
  revalidatePath("/dashboard");
}

// ---------- Предметы ----------
export async function createSubject(formData: FormData) {
  await assertEditor();
  const name = str(formData.get("name"));
  if (!name) throw new Error("Укажите название предмета");
  await prisma.subject.create({
    data: {
      name,
      price: int(formData.get("price")),
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

// ---------- Абонементы ----------
export async function createSubscription(studentId: string, formData: FormData) {
  await assertEditor("finance");
  const months = int(formData.get("months")) || 1;
  const start = parseDate(formData.get("startDate")) ?? new Date();
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + months);
  const withInvoice = str(formData.get("invoice")) === "on";

  const subjectIds = formData.getAll("subjects").map((v) => String(v)).filter(Boolean);

  let plan: string;
  let price: number;
  let basePrice = 0;
  let discountName: string | null = null;
  let discountPct = 0;
  let multiPct = 0;
  let promoCode: string | null = null;
  let promoApplyId: string | null = null;
  let items: { subjectId: string; subjectName: string; base: number; amount: number }[] = [];

  if (subjectIds.length > 0) {
    // Новый режим: комбо-абонемент по предметам со скидками
    const settings = await getSettings();
    const subs = await prisma.subject.findMany({ where: { id: { in: subjectIds } } });
    // сохранить порядок выбора
    const chosen = subjectIds.map((id) => subs.find((s) => s.id === id)).filter(Boolean) as typeof subs;
    if (chosen.length === 0) throw new Error("Предметы не найдены");

    const discName = str(formData.get("discount"));
    const disc = parseDiscounts(settings.discounts).find((d) => d.name === discName);
    discountName = disc ? disc.name : null;
    discountPct = disc ? disc.percent : 0;
    multiPct = multiPercentFor(chosen.length, parseMultiTiers(settings.multiDiscount));

    // Персональная скидка ученика и авто-скидка «брат/сестра» (по телефону родителя)
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { personalDiscount: true, parentPhone: true } });
    const personalPct = Math.max(0, student?.personalDiscount ?? 0);
    let siblingPct = 0;
    if (settings.siblingDiscount > 0 && student?.parentPhone) {
      const sib = await prisma.student.count({ where: { id: { not: studentId }, status: "ACTIVE", parentPhone: student.parentPhone } });
      if (sib > 0) siblingPct = settings.siblingDiscount;
    }

    // Промокод (если введён и действителен)
    let promoPct = 0;
    const codeInput = str(formData.get("promo"));
    if (codeInput) {
      const code = codeInput.trim().toUpperCase().replace(/\s+/g, "");
      const promo = await prisma.promoCode.findUnique({ where: { code } });
      if (!promo || !promo.active) throw new Error("Промокод не найден или отключён");
      if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) throw new Error("Промокод исчерпан");
      if (promo.expiresAt && promo.expiresAt < new Date()) throw new Error("Срок действия промокода истёк");
      promoPct = promo.percent;
      promoCode = promo.code;
      promoApplyId = promo.id;
    }

    const mode = isDiscountMode(settings.discountMode) ? settings.discountMode : "add";
    const pricing = computePricing({
      subjects: chosen.map((s) => ({ id: s.id, name: s.name, price: s.price })),
      months,
      discountParts: [discountPct, multiPct, personalPct, siblingPct, promoPct],
      mode,
    });
    basePrice = pricing.base;
    price = pricing.total;
    plan = chosen.map((s) => s.name).join(" + ");
    items = pricing.items.map((it) => ({ subjectId: it.id, subjectName: it.name, base: it.base, amount: it.amount }));
  } else {
    // Старый режим: ручная цена
    plan = str(formData.get("plan")) || "Абонемент";
    price = int(formData.get("price"));
    basePrice = price;
  }

  const subscription = await prisma.subscription.create({
    data: {
      studentId,
      plan,
      months,
      price,
      basePrice,
      discountName,
      discountPct,
      multiPct,
      promoCode,
      startDate: start,
      endDate: end,
      status: "ACTIVE",
      items: items.length > 0 ? { create: items } : undefined,
    },
  });

  if (promoApplyId) {
    await prisma.promoCode.update({ where: { id: promoApplyId }, data: { usedCount: { increment: 1 } } });
  }

  if (withInvoice && price > 0) {
    // счёт наследует разбивку по предметам из абонемента (для дохода по предметам)
    const payItems = items.map((it) => ({ subjectId: it.subjectId, subjectName: it.subjectName, amount: it.amount }));
    await prisma.payment.create({
      data: {
        studentId,
        purpose: `Абонемент · ${plan}`,
        amount: price,
        status: "PENDING",
        date: start,
        items: payItems.length > 0 ? { create: payItems } : undefined,
      },
    });
    await recalc(studentId);
  }

  const stSub = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } });
  const savedLabel = basePrice > price && basePrice > 0 ? ` (−${Math.round((1 - price / basePrice) * 100)}%)` : "";
  await logAudit("CREATE", "Абонемент", `${stSub?.name ?? ""} · ${plan}${savedLabel}`);
  void subscription;
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  revalidatePath("/dashboard");
}

// Автопометка просроченных счетов (server action). Cron вызывает markOverdue() напрямую.
export async function refreshOverdue() {
  if (!(await auth())?.user) throw new Error("Требуется вход");
  return markOverdue();
}

// ---------- Расписание ----------
export async function createLesson(formData: FormData) {
  await assertEditor();
  const groupId = str(formData.get("groupId"));
  if (!groupId) throw new Error("Выберите группу");
  const lesson = await prisma.lesson.create({
    data: {
      groupId,
      dayOfWeek: int(formData.get("dayOfWeek")) || 1,
      startTime: str(formData.get("startTime")) || "16:00",
      room: str(formData.get("room")) || "Каб. 1",
    },
    include: { group: { select: { name: true } } },
  });
  await logAudit("CREATE", "Занятие", `${lesson.group.name} · ${lesson.startTime}`);
  revalidatePath("/schedule");
  revalidatePath("/dashboard");
}

export async function updateLesson(id: string, formData: FormData) {
  await assertEditor();
  const lesson = await prisma.lesson.update({
    where: { id },
    data: {
      groupId: str(formData.get("groupId")) || undefined,
      dayOfWeek: int(formData.get("dayOfWeek")) || 1,
      startTime: str(formData.get("startTime")) || "16:00",
      room: str(formData.get("room")) || "Каб. 1",
    },
    include: { group: { select: { name: true } } },
  });
  await logAudit("UPDATE", "Занятие", `${lesson.group.name} · ${lesson.startTime}`);
  revalidatePath("/schedule");
  revalidatePath(`/schedule/${id}`);
}

export async function deleteLesson(id: string) {
  await assertEditor();
  const lesson = await prisma.lesson.delete({ where: { id }, include: { group: { select: { name: true } } } });
  await logAudit("DELETE", "Занятие", `${lesson.group.name} · ${lesson.startTime}`);
  revalidatePath("/schedule");
}

// ---------- Отработки ----------
// Право такое же, как на отметку посещаемости: админ/менеджер или учитель этой группы.
async function assertCanMarkLesson(lessonId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Требуется вход");
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { group: { include: { teacher: true } } },
  });
  if (!lesson) throw new Error("Занятие не найдено");
  const owns = lesson.group.teacher?.userId === session.user.id;
  if (!(await canEditData(session.user.role)) && !owns) throw new Error("Недостаточно прав");
  return { session, lesson };
}

export async function scheduleMakeup(formData: FormData) {
  const lessonId = str(formData.get("lessonId"));
  const studentId = str(formData.get("studentId"));
  const missedDate = parseDate(formData.get("missedDate"));
  const plannedAt = parseDate(formData.get("plannedAt"));
  if (!lessonId || !studentId || !missedDate || !plannedAt) throw new Error("Заполните ученика, занятие и даты");

  const { session, lesson } = await assertCanMarkLesson(lessonId);
  await prisma.makeup.upsert({
    where: { studentId_lessonId_missedDate: { studentId, lessonId, missedDate } },
    create: {
      studentId,
      lessonId,
      missedDate,
      plannedAt,
      note: str(formData.get("note")) || null,
      createdBy: session.user?.name ?? null,
    },
    update: { plannedAt, status: "PLANNED", note: str(formData.get("note")) || null },
  });
  const stu = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } });
  await logAudit("CREATE", "Отработка", `${stu?.name ?? ""} · ${lesson.group.name}`);
  revalidatePath("/makeups");
}

// Отработка проведена: ставим посещение на дату отработки — за него преподавателю платят.
export async function completeMakeup(id: string) {
  const m = await prisma.makeup.findUnique({ where: { id }, include: { student: { select: { name: true } } } });
  if (!m) throw new Error("Отработка не найдена");
  await assertCanMarkLesson(m.lessonId);

  const date = new Date(Date.UTC(m.plannedAt.getUTCFullYear(), m.plannedAt.getUTCMonth(), m.plannedAt.getUTCDate()));
  await prisma.$transaction([
    prisma.attendance.upsert({
      where: { lessonId_studentId_date: { lessonId: m.lessonId, studentId: m.studentId, date } },
      create: { lessonId: m.lessonId, studentId: m.studentId, date, present: true, excused: false },
      update: { present: true, excused: false },
    }),
    prisma.makeup.update({ where: { id }, data: { status: "DONE" } }),
  ]);

  await recalcAttendance([m.studentId]);
  await logAudit("UPDATE", "Отработка", `${m.student.name} · проведена`);
  revalidatePath("/makeups");
  revalidatePath("/payroll");
  revalidatePath("/students");
}

export async function cancelMakeup(id: string) {
  const m = await prisma.makeup.findUnique({ where: { id }, include: { student: { select: { name: true } } } });
  if (!m) return;
  await assertCanMarkLesson(m.lessonId);
  await prisma.makeup.update({ where: { id }, data: { status: "CANCELLED" } });
  await logAudit("UPDATE", "Отработка", `${m.student.name} · отменена`);
  revalidatePath("/makeups");
}

// ---------- Посещаемость ----------
// Отмена/восстановление занятия в конкретную дату.
// При отмене отметки посещаемости за этот день удаляются: занятия не было.
export async function setLessonCancelled(lessonId: string, dateStr: string, cancelled: boolean, reason: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Требуется вход");
  const date = new Date(dateStr + "T00:00:00.000Z");

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { group: { include: { teacher: true, students: { select: { id: true } } } } },
  });
  if (!lesson) throw new Error("Занятие не найдено");
  const ownsLesson = lesson.group.teacher?.userId === session.user.id;
  if (!(await canEditData(session.user.role)) && !ownsLesson) throw new Error("Недостаточно прав");

  if (cancelled) {
    await prisma.attendance.deleteMany({ where: { lessonId, date } });
    await prisma.lessonSession.upsert({
      where: { lessonId_date: { lessonId, date } },
      create: { lessonId, date, topic: "", cancelled: true, cancelReason: str(reason) || null },
      update: { cancelled: true, cancelReason: str(reason) || null },
    });
  } else {
    await prisma.lessonSession.updateMany({ where: { lessonId, date }, data: { cancelled: false, cancelReason: null } });
  }

  await logAudit("UPDATE", "Занятие", `${lesson.group.name} · ${dateStr} · ${cancelled ? "отменено" : "восстановлено"}`);

  const stC = await getSettings();
  if (cancelled && stC.notifyCancel) {
    await notifyParents(
      lesson.group.students.map((s) => s.id),
      renderTemplate(stC.tplCancel || DEFAULT_TEMPLATES.cancel, {
        school: stC.schoolName,
        group: lesson.group.name,
        date: new Date(dateStr).toLocaleDateString("ru-RU"),
        reason: str(reason) || "",
      })
    );
  }
  revalidatePath(`/schedule/${lessonId}`);
  revalidatePath("/journal");
  revalidatePath("/payroll");
}

export async function saveAttendance(lessonId: string, dateStr: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Требуется вход");
  const date = new Date(dateStr + "T00:00:00.000Z");

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { group: { include: { students: true, teacher: true } } },
  });
  if (!lesson) throw new Error("Занятие не найдено");

  // Отмечать может админ/менеджер ИЛИ учитель, ведущий эту группу
  const ownsLesson = lesson.group.teacher?.userId === session.user.id;
  if (!await canEditData(session.user.role) && !ownsLesson) throw new Error("Недостаточно прав");

  const students = lesson.group.students;

  await prisma.$transaction(
    students.map((s) => {
      // состояние: present | excused | unexcused
      const st = String(formData.get(`att_${s.id}`) ?? "present");
      const present = st === "present";
      const excused = st === "excused";
      return prisma.attendance.upsert({
        where: { lessonId_studentId_date: { lessonId, studentId: s.id, date } },
        create: { lessonId, studentId: s.id, date, present, excused },
        update: { present, excused },
      });
    })
  );

  // Тема урока (журнал): пусто — убираем запись, иначе сохраняем/обновляем
  const topic = str(formData.get("topic"));
  if (topic) {
    await prisma.lessonSession.upsert({
      where: { lessonId_date: { lessonId, date } },
      create: { lessonId, date, topic },
      update: { topic },
    });
  } else {
    await prisma.lessonSession.deleteMany({ where: { lessonId, date } });
  }

  await recalcAttendance(students.map((s) => s.id));

  revalidatePath(`/schedule/${lessonId}`);
  revalidatePath("/schedule");
  revalidatePath("/students");
}

// ---------- Рассылка родителям в Telegram ----------
export async function broadcastTelegram(formData: FormData): Promise<{ sent: number; total: number; error?: string }> {
  await assertEditor();
  const text = str(formData.get("text"));
  if (!text) return { sent: 0, total: 0, error: "Введите текст сообщения" };
  const group = str(formData.get("group"));

  const students = await prisma.student.findMany({
    where: {
      telegramChatId: { not: null },
      ...(group && group !== "all" ? { groups: { some: { id: group } } } : {}),
    },
    select: { telegramChatId: true },
  });

  if (students.length === 0) return { sent: 0, total: 0, error: "Нет родителей с подключённым Telegram" };

  const message = `📣 <b>Сообщение от школы</b>\n\n${text}`;
  let sent = 0;
  for (const s of students) {
    if (s.telegramChatId && (await sendTelegram(s.telegramChatId, message))) sent++;
  }
  await logAudit("CREATE", "Рассылка", `${sent}/${students.length} родителям`);
  return { sent, total: students.length };
}

// ---------- Домашние задания ----------
async function assertCanManageGroup(groupId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Требуется вход");
  if (await canEditData(session.user.role)) return session;
  const group = await prisma.group.findUnique({ where: { id: groupId }, include: { teacher: true } });
  if (session.user.role === "TEACHER" && group?.teacher?.userId === session.user.id) return session;
  throw new Error("Недостаточно прав");
}

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
    await notifyParents(
      await studentIdsOfGroup(groupId),
      renderTemplate(stH.tplHomework || DEFAULT_TEMPLATES.homework, {
        school: stH.schoolName,
        group: group?.name ?? "",
        title: str(formData.get("title")) || "Домашнее задание",
        due: due ? `, срок: ${due.toLocaleDateString("ru-RU")}` : "",
      })
    );
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

// ---------- Расходы школы ----------
function expenseData(formData: FormData) {
  const title = str(formData.get("title"));
  if (!title) throw new Error("Укажите, за что расход");
  const amount = int(formData.get("amount"));
  if (amount <= 0) throw new Error("Сумма должна быть больше нуля");
  return {
    title,
    amount,
    category: str(formData.get("category")) || "OTHER",
    date: parseDate(formData.get("date")) ?? new Date(),
    note: str(formData.get("note")) || null,
  };
}

export async function createExpense(formData: FormData) {
  await assertEditor("finance");
  const session = await auth();
  const data = expenseData(formData);
  await prisma.expense.create({ data: { ...data, createdBy: session?.user?.name ?? null } });
  await logAudit("CREATE", "Расход", `${data.title} · ${money(data.amount)}`);
  revalidatePath("/expenses");
  revalidatePath("/reports");
}

export async function updateExpense(id: string, formData: FormData) {
  await assertEditor("finance");
  const data = expenseData(formData);
  await prisma.expense.update({ where: { id }, data });
  await logAudit("UPDATE", "Расход", `${data.title} · ${money(data.amount)}`);
  revalidatePath("/expenses");
  revalidatePath("/reports");
}

export async function deleteExpense(id: string) {
  await assertEditor("finance");
  const e = await prisma.expense.findUnique({ where: { id }, select: { title: true, amount: true } });
  await prisma.expense.delete({ where: { id } });
  await logAudit("DELETE", "Расход", e ? `${e.title} · ${money(e.amount)}` : id);
  revalidatePath("/expenses");
  revalidatePath("/reports");
}

// ---------- Оценки ----------
// Ставить оценку может админ/менеджер или учитель группы ученика.
async function assertCanGrade(studentId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Требуется вход");
  if (await canEditData(session.user.role)) return session;
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { groups: { include: { teacher: true } } },
  });
  if (session.user.role === "TEACHER" && student?.groups.some((g) => g.teacher?.userId === session.user.id)) return session;
  throw new Error("Недостаточно прав");
}

export async function addGrade(studentId: string, formData: FormData) {
  const session = await assertCanGrade(studentId);
  const score = int(formData.get("score"));
  const maxScore = Math.max(1, int(formData.get("maxScore")) || 100);
  await prisma.grade.create({
    data: {
      studentId,
      topic: str(formData.get("topic")) || "Оценка",
      type: str(formData.get("type")) || "TEST",
      score,
      maxScore,
      comment: str(formData.get("comment")) || null,
      date: parseDate(formData.get("date")) ?? new Date(),
      createdBy: session.user?.name ?? null,
    },
  });
  await logAudit("CREATE", "Оценка", `${score}/${maxScore} · ${str(formData.get("topic"))}`);

  const st = await getSettings();
  if (st.notifyGrade) {
    const stu = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } });
    await notifyParent(
      studentId,
      renderTemplate(st.tplGrade || DEFAULT_TEMPLATES.grade, {
        school: st.schoolName,
        name: stu?.name ?? "",
        topic: str(formData.get("topic")) || "Оценка",
        score,
        max: maxScore,
        pct: Math.round((score / maxScore) * 100),
      })
    );
  }

  revalidatePath("/grades");
  revalidatePath(`/students/${studentId}`);
}

export async function deleteGrade(id: string) {
  const grade = await prisma.grade.findUnique({ where: { id } });
  if (!grade) return;
  await assertCanGrade(grade.studentId);
  await prisma.grade.delete({ where: { id } });
  await logAudit("DELETE", "Оценка", `${grade.score}/${grade.maxScore} · ${grade.topic}`);
  revalidatePath("/grades");
  revalidatePath(`/students/${grade.studentId}`);
}

// ---------- Тесты ----------
export async function createTest(formData: FormData) {
  const groupId = str(formData.get("groupId")) || null;
  const subjectId = str(formData.get("subjectId")) || null;
  if (groupId) await assertCanManageGroup(groupId);
  else await assertEditor();
  const test = await prisma.test.create({
    data: {
      title: str(formData.get("title")) || "Тест",
      groupId,
      subjectId,
      maxScore: Math.max(1, int(formData.get("maxScore")) || 100),
      date: parseDate(formData.get("date")) ?? new Date(),
      shuffle: formData.get("shuffle") != null,
      allowRetake: formData.get("allowRetake") != null,
    },
  });
  await logAudit("CREATE", "Тест", `${test.title}`);
  revalidatePath("/tests");
  redirect(`/tests/${test.id}`);
}

export async function saveTestResults(testId: string, formData: FormData) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: { group: { include: { students: { select: { id: true } } } } },
  });
  if (!test) throw new Error("Тест не найден");
  if (!test.groupId || !test.group) throw new Error("У теста нет группы для ввода оценок");
  const session = await assertCanManageGroup(test.groupId);

  let saved = 0;
  for (const s of test.group.students) {
    const raw = formData.get(`score_${s.id}`);
    const val = raw == null || String(raw).trim() === "" ? null : int(raw);
    if (val == null) {
      // очистить, если было
      await prisma.grade.deleteMany({ where: { testId, studentId: s.id } });
      continue;
    }
    const score = Math.max(0, Math.min(val, test.maxScore));
    await prisma.grade.upsert({
      where: { testId_studentId: { testId, studentId: s.id } },
      create: {
        studentId: s.id,
        testId,
        topic: test.title,
        type: "TEST",
        score,
        maxScore: test.maxScore,
        date: test.date,
        createdBy: session.user?.name ?? null,
      },
      update: { score, maxScore: test.maxScore, topic: test.title, date: test.date },
    });
    saved++;
  }
  await logAudit("UPDATE", "Тест", `${test.title} · ${saved} оценок`);
  revalidatePath(`/tests/${testId}`);
  revalidatePath("/tests");
  revalidatePath("/grades");
}

// Ученик проходит тест (одна попытка): авто-проверка по правильным ответам.
export async function submitTestAttempt(testId: string, formData: FormData) {
  const session = await auth();
  const studentId = await getStudentIdForUser(session?.user?.id);
  if (!studentId) throw new Error("Профиль ученика не найден");

  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      questions: { orderBy: { order: "asc" }, select: { id: true, correct: true } },
      group: { include: { lessons: { select: { dayOfWeek: true, startTime: true } } } },
    },
  });
  if (!test) throw new Error("Тест не найден");
  if (!test.groupId || !test.group) throw new Error("Тест не привязан к группе");
  if (test.questions.length === 0) throw new Error("В тесте нет вопросов");

  // Ученик должен состоять в группе теста
  const inGroup = await prisma.student.findFirst({ where: { id: studentId, groups: { some: { id: test.groupId } } }, select: { id: true } });
  if (!inGroup) throw new Error("Тест не для вашей группы");

  // Тест открывается только после времени урока по расписанию
  const tz = (await getSettings()).tzOffsetHours;
  if (!isTestOpen(test.date, test.group.lessons, new Date(), tz)) throw new Error("Тест ещё не открыт");

  // Одна попытка, если преподаватель не разрешил проходить заново
  const existing = await prisma.testAttempt.findUnique({ where: { testId_studentId: { testId, studentId } }, select: { id: true } });
  if (existing && !test.allowRetake) throw new Error("Тест уже пройден");

  const answers = test.questions.map((q) => {
    const raw = formData.get(`q_${q.id}`);
    const n = raw == null ? -1 : parseInt(String(raw), 10);
    return isNaN(n) ? -1 : n;
  });
  const total = test.questions.length;
  const correctCount = test.questions.reduce((a, q, i) => a + (answers[i] === q.correct ? 1 : 0), 0);
  const score = Math.round((correctCount / total) * test.maxScore);

  await prisma.testAttempt.upsert({
    where: { testId_studentId: { testId, studentId } },
    create: { testId, studentId, answers, correctCount, total, score },
    update: { answers, correctCount, total, score, submittedAt: new Date() },
  });

  // Результат сразу становится оценкой за тест
  await prisma.grade.upsert({
    where: { testId_studentId: { testId, studentId } },
    create: {
      studentId,
      testId,
      topic: test.title,
      type: "TEST",
      score,
      maxScore: test.maxScore,
      date: new Date(),
      createdBy: session?.user?.name ?? null,
    },
    update: { score, maxScore: test.maxScore, topic: test.title },
  });

  revalidatePath(`/cabinet/test/${testId}`);
  revalidatePath("/cabinet");
  revalidatePath(`/tests/${testId}`);
  revalidatePath("/grades");
}

export async function deleteTest(id: string) {
  const test = await prisma.test.findUnique({ where: { id }, select: { groupId: true, title: true } });
  if (!test) return;
  if (test.groupId) await assertCanManageGroup(test.groupId);
  else await assertEditor();
  await prisma.test.delete({ where: { id } }); // каскадом удаляются связанные оценки
  await logAudit("DELETE", "Тест", test.title);
  revalidatePath("/tests");
  revalidatePath("/grades");
}

// ---------- Зарплата: фиксация месяца ----------
// Снимок расчёта за месяц, чтобы прошлые месяцы не пересчитывались при изменении ставок/состава.
export async function lockPayrollMonth(year: number, month0: number) {
  await assertEditor("payroll");
  const settings = await getSettings();
  const feePct = settings.schoolFeePct;
  const rows = await gatherPayroll(year, month0, feePct);

  const session = await auth();
  for (const [teacherId, r] of rows) {
    await prisma.payrollRecord.upsert({
      where: { teacherId_year_month: { teacherId, year, month: month0 } },
      create: { teacherId, year, month: month0, rate: feePct, rateType: "ATTENDANCE", base: r.base, salary: r.salary, createdBy: session?.user?.name ?? null },
      update: { rate: feePct, rateType: "ATTENDANCE", base: r.base, salary: r.salary, createdBy: session?.user?.name ?? null },
    });
  }
  await logAudit("UPDATE", "Зарплата", `Зафиксирован месяц ${month0 + 1}.${year}`);
  revalidatePath("/payroll");
}

export async function unlockPayrollMonth(year: number, month0: number) {
  await assertEditor("payroll");
  await prisma.payrollRecord.deleteMany({ where: { year, month: month0 } });
  await logAudit("UPDATE", "Зарплата", `Снята фиксация месяца ${month0 + 1}.${year}`);
  revalidatePath("/payroll");
}

// ---------- Оплаты ----------
export async function createPayment(formData: FormData) {
  await assertEditor("finance");
  const studentId = str(formData.get("studentId"));
  if (!studentId) throw new Error("Выберите ученика");
  const amount = int(formData.get("amount"));
  const status = str(formData.get("status")) || "PAID";

  // Разбивка платежа по выбранным предметам (пропорционально базовой цене предмета)
  const subjectIds = formData.getAll("subjects").map((v) => String(v)).filter(Boolean);
  let payItems: { subjectId: string; subjectName: string; amount: number }[] = [];
  if (subjectIds.length > 0) {
    const subs = await prisma.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true, price: true } });
    const chosen = subjectIds.map((id) => subs.find((s) => s.id === id)).filter(Boolean) as typeof subs;
    payItems = splitByPrice(amount, chosen).map((r) => ({ subjectId: r.id, subjectName: r.name, amount: r.amount }));
  }

  const method = str(formData.get("method")) || null;
  const paidNow = status === "PAID" ? amount : 0;
  await prisma.payment.create({
    data: {
      studentId,
      purpose: str(formData.get("purpose")) || "Оплата",
      method,
      amount,
      status,
      paidAmount: paidNow,
      items: payItems.length > 0 ? { create: payItems } : undefined,
      // Деньги, полученные сразу, тоже становятся движением — доход считается по ним
      txs: paidNow > 0 ? { create: [{ kind: "PAYMENT", amount: paidNow, method }] } : undefined,
    },
  });
  const st0 = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } });
  await logAudit("CREATE", status === "PAID" ? "Оплата" : "Счёт", `${st0?.name ?? ""} · ${money(amount)}`);
  // Задолженность считается автоматически из неоплаченных счетов
  await recalc(studentId);
  revalidatePath("/payments");
  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/dashboard");
}

// Отметить счёт оплаченным (гасит долг)
// Принять оплату по счёту: сумма по умолчанию — весь остаток (кнопка «Оплачен»),
// либо частичная сумма из формы.
export async function receivePayment(paymentId: string, amountIn: number | null, method?: string, dateStr?: string) {
  await assertEditor("finance");
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { student: { select: { name: true } } },
  });
  if (!payment) throw new Error("Счёт не найден");

  const left = outstanding(payment.amount, payment.paidAmount);
  if (left <= 0) throw new Error("Счёт уже оплачен полностью");
  const sum = amountIn == null ? left : Math.min(Math.max(1, amountIn), left);

  const session = await auth();
  const paidAmount = payment.paidAmount + sum;
  await prisma.$transaction([
    prisma.paymentTx.create({
      data: {
        paymentId,
        kind: "PAYMENT",
        amount: sum,
        method: method || payment.method,
        date: parseDate(dateStr ?? null) ?? new Date(),
        createdBy: session?.user?.name ?? null,
      },
    }),
    prisma.payment.update({
      where: { id: paymentId },
      data: {
        paidAmount,
        method: method || payment.method,
        status: paymentStatus(payment.amount, paidAmount, payment.date),
      },
    }),
  ]);

  await logAudit(
    "UPDATE",
    "Оплата",
    `${payment.student.name} · принято ${money(sum)}${paidAmount < payment.amount ? ` · остаток ${money(payment.amount - paidAmount)}` : " · оплачен полностью"}`
  );
  await recalc(payment.studentId);
  revalidatePath("/payments");
  revalidatePath("/students");
  revalidatePath(`/students/${payment.studentId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

// Приём оплаты из формы (частичной или полной).
export async function receivePaymentForm(paymentId: string, formData: FormData) {
  const asked = int(formData.get("amount"));
  return receivePayment(
    paymentId,
    asked > 0 ? asked : null,
    str(formData.get("method")) || undefined,
    str(formData.get("date")) || undefined
  );
}

// Совместимость со старой кнопкой «Оплачен» — принимает весь остаток.
export async function markPaid(paymentId: string, method?: string) {
  return receivePayment(paymentId, null, method);
}

// Возврат денег родителю. Уменьшает доход тем месяцем, когда возврат сделан.
export async function refundPayment(paymentId: string, formData: FormData) {
  await assertEditor("finance");
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { student: { select: { name: true } } },
  });
  if (!payment) throw new Error("Счёт не найден");

  const canRefund = maxRefundable(payment.paidAmount, payment.refundedAmount);
  if (canRefund <= 0) throw new Error("По этому счёту возвращать нечего");
  const asked = int(formData.get("amount"));
  const sum = Math.min(Math.max(1, asked || canRefund), canRefund);

  const session = await auth();
  await prisma.$transaction([
    prisma.paymentTx.create({
      data: {
        paymentId,
        kind: "REFUND",
        amount: sum,
        method: str(formData.get("method")) || payment.method,
        date: parseDate(formData.get("date")) ?? new Date(),
        note: str(formData.get("note")) || null,
        createdBy: session?.user?.name ?? null,
      },
    }),
    prisma.payment.update({
      where: { id: paymentId },
      data: { refundedAmount: payment.refundedAmount + sum },
    }),
  ]);

  await logAudit("UPDATE", "Возврат", `${payment.student.name} · ${money(sum)}`);
  await recalc(payment.studentId);
  revalidatePath("/payments");
  revalidatePath("/students");
  revalidatePath(`/students/${payment.studentId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

export async function deletePayment(paymentId: string) {
  await assertEditor("finance");
  const payment = await prisma.payment.delete({ where: { id: paymentId }, include: { student: { select: { name: true } } } });
  await logAudit("DELETE", "Оплата", `${payment.student.name} · ${money(payment.amount)}`);
  await recalc(payment.studentId);
  revalidatePath("/payments");
  revalidatePath("/students");
  revalidatePath(`/students/${payment.studentId}`);
  revalidatePath("/dashboard");
}
