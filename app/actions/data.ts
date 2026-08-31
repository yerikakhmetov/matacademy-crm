"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData, MANAGER_PERMS } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { money } from "@/lib/format";
import { tariffsFromText, getSettings, parseDiscounts, parseMultiTiers, multiPercentFor, computePricing } from "@/lib/settings";
import { sendTelegram } from "@/lib/telegram";
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

async function assertEditor() {
  const session = await auth();
  if (!session?.user) throw new Error("Требуется вход");
  if (!(await canEditData(session.user.role))) throw new Error("Недостаточно прав");
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
  };
  await prisma.settings.upsert({ where: { id: "main" }, update: data, create: { id: "main", ...data } });
  await logAudit("UPDATE", "Настройки", "Параметры школы обновлены");
  revalidatePath("/settings");
  revalidatePath("/", "layout");
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
// Баланс отрицательный = долг. Экспортируется для переиспользования.
export async function recalcBalance(studentId: string) {
  const unpaid = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: { studentId, status: { in: ["PENDING", "OVERDUE"] } },
  });
  const debt = unpaid._sum.amount ?? 0;
  await prisma.student.update({ where: { id: studentId }, data: { balance: -debt } });
}

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
      groupId: str(formData.get("groupId")) || null,
      status: str(formData.get("status")) || "ACTIVE",
      attendance: 90,
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
      groupId: str(formData.get("groupId")) || null,
      status: str(formData.get("status")) || "ACTIVE",
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
  await assertEditor();
  const subjectIds = formData.getAll("subjects").map((v) => String(v)).filter(Boolean);
  await prisma.teacher.create({
    data: {
      name: str(formData.get("name")),
      specialty: str(formData.get("specialty")),
      phone: str(formData.get("phone")) || null,
      color: str(formData.get("color")) || "#3A5AE0",
      rate: int(formData.get("rate")),
      rateType: str(formData.get("rateType")) || "PER_LESSON",
      subjects: subjectIds.length ? { connect: subjectIds.map((id) => ({ id })) } : undefined,
    },
  });
  await logAudit("CREATE", "Преподаватель", str(formData.get("name")));
  revalidatePath("/teachers");
}

export async function updateTeacher(id: string, formData: FormData) {
  await assertEditor();
  const subjectIds = formData.getAll("subjects").map((v) => String(v)).filter(Boolean);
  await prisma.teacher.update({
    where: { id },
    data: {
      name: str(formData.get("name")),
      specialty: str(formData.get("specialty")),
      phone: str(formData.get("phone")) || null,
      color: str(formData.get("color")) || "#3A5AE0",
      rate: int(formData.get("rate")),
      rateType: str(formData.get("rateType")) || "PER_LESSON",
      subjects: { set: subjectIds.map((id) => ({ id })) },
    },
  });
  await logAudit("UPDATE", "Преподаватель", str(formData.get("name")));
  revalidatePath("/teachers");
  revalidatePath("/payroll");
}

export async function deleteTeacher(id: string) {
  await assertEditor();
  const t = await prisma.teacher.findUnique({ where: { id }, select: { name: true } });
  await prisma.teacher.delete({ where: { id } }); // группы открепляются (teacherId -> null)
  await logAudit("DELETE", "Преподаватель", t?.name ?? id);
  revalidatePath("/teachers");
  revalidatePath("/groups");
}

// Изменить ставку преподавателя
export async function updateTeacherRate(id: string, formData: FormData) {
  await assertEditor();
  await prisma.teacher.update({
    where: { id },
    data: { rate: int(formData.get("rate")), rateType: str(formData.get("rateType")) || "PER_LESSON" },
  });
  await logAudit("UPDATE", "Ставка преподавателя", `${int(formData.get("rate"))}`);
  revalidatePath("/payroll");
  revalidatePath("/teachers");
}

// ---------- Лиды ----------
export async function createLead(formData: FormData) {
  await assertEditor();
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
  await assertEditor();
  await prisma.lead.update({ where: { id }, data: { stage } });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/dashboard");
}

export async function updateLead(id: string, formData: FormData) {
  await assertEditor();
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
  await assertEditor();
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
  await assertEditor();
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
  await assertEditor();
  const a = await prisma.leadActivity.findUnique({ where: { id: activityId } });
  if (!a) return;
  await prisma.leadActivity.update({ where: { id: activityId }, data: { done: !a.done } });
  revalidatePath(`/leads/${a.leadId}`);
  revalidatePath("/leads");
}

// Перевод лида в ученики (создаёт ученика, помечает лид как «Оплатили»)
export async function convertLeadToStudent(leadId: string, formData: FormData) {
  await assertEditor();
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Лид не найден");

  const newStudent = await prisma.student.create({
    data: {
      name: str(formData.get("name")) || lead.childName || lead.name,
      grade: str(formData.get("grade")) || lead.grade || null,
      groupId: str(formData.get("groupId")) || null,
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
  await assertEditor();
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

    const pricing = computePricing({
      subjects: chosen.map((s) => ({ id: s.id, name: s.name, price: s.price })),
      months,
      discountPct,
      multiPct,
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
      startDate: start,
      endDate: end,
      status: "ACTIVE",
      items: items.length > 0 ? { create: items } : undefined,
    },
  });

  if (withInvoice && price > 0) {
    await prisma.payment.create({
      data: { studentId, purpose: `Абонемент · ${plan}`, amount: price, status: "PENDING", date: start },
    });
    await recalcBalance(studentId);
  }

  const stSub = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } });
  const savedLabel = discountPct + multiPct > 0 ? ` (−${discountPct + multiPct}%)` : "";
  await logAudit("CREATE", "Абонемент", `${stSub?.name ?? ""} · ${plan}${savedLabel}`);
  void subscription;
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  revalidatePath("/dashboard");
}

// Автопометка просроченных счетов: PENDING со сроком раньше сегодняшнего → OVERDUE
export async function refreshOverdue() {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const res = await prisma.payment.updateMany({
    where: { status: "PENDING", date: { lt: start } },
    data: { status: "OVERDUE" },
  });
  if (res.count > 0) {
    const affected = await prisma.payment.findMany({ where: { status: "OVERDUE" }, select: { studentId: true }, distinct: ["studentId"] });
    for (const a of affected) await recalcBalance(a.studentId);
  }
  return res.count;
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

// ---------- Посещаемость ----------
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
      const present = formData.get(`p_${s.id}`) === "on";
      return prisma.attendance.upsert({
        where: { lessonId_studentId_date: { lessonId, studentId: s.id, date } },
        create: { lessonId, studentId: s.id, date, present },
        update: { present },
      });
    })
  );

  // Пересчёт % посещаемости по всем отметкам ученика
  for (const s of students) {
    const recs = await prisma.attendance.findMany({ where: { studentId: s.id } });
    if (recs.length > 0) {
      const pct = Math.round((recs.filter((r) => r.present).length / recs.length) * 100);
      await prisma.student.update({ where: { id: s.id }, data: { attendance: pct } });
    }
  }

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
      ...(group && group !== "all" ? { groupId: group } : {}),
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

// ---------- Оценки ----------
// Ставить оценку может админ/менеджер или учитель группы ученика.
async function assertCanGrade(studentId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Требуется вход");
  if (await canEditData(session.user.role)) return session;
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { group: { include: { teacher: true } } },
  });
  if (session.user.role === "TEACHER" && student?.group?.teacher?.userId === session.user.id) return session;
  throw new Error("Недостаточно прав");
}

export async function addGrade(studentId: string, formData: FormData) {
  const session = await assertCanGrade(studentId);
  const score = int(formData.get("score"));
  const maxScore = int(formData.get("maxScore")) || 100;
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
  const groupId = str(formData.get("groupId"));
  if (!groupId) throw new Error("Выберите группу");
  await assertCanManageGroup(groupId);
  const test = await prisma.test.create({
    data: {
      title: str(formData.get("title")) || "Тест",
      groupId,
      maxScore: int(formData.get("maxScore")) || 100,
      date: parseDate(formData.get("date")) ?? new Date(),
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

export async function deleteTest(id: string) {
  const test = await prisma.test.findUnique({ where: { id }, select: { groupId: true, title: true } });
  if (!test) return;
  await assertCanManageGroup(test.groupId);
  await prisma.test.delete({ where: { id } }); // каскадом удаляются связанные оценки
  await logAudit("DELETE", "Тест", test.title);
  revalidatePath("/tests");
  revalidatePath("/grades");
}

// ---------- Оплаты ----------
export async function createPayment(formData: FormData) {
  await assertEditor();
  const studentId = str(formData.get("studentId"));
  if (!studentId) throw new Error("Выберите ученика");
  const amount = int(formData.get("amount"));
  const status = str(formData.get("status")) || "PAID";
  await prisma.payment.create({
    data: {
      studentId,
      purpose: str(formData.get("purpose")) || "Оплата",
      method: str(formData.get("method")) || null,
      amount,
      status,
    },
  });
  const st0 = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } });
  await logAudit("CREATE", status === "PAID" ? "Оплата" : "Счёт", `${st0?.name ?? ""} · ${money(amount)}`);
  // Задолженность считается автоматически из неоплаченных счетов
  await recalcBalance(studentId);
  revalidatePath("/payments");
  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/dashboard");
}

// Отметить счёт оплаченным (гасит долг)
export async function markPaid(paymentId: string, method?: string) {
  await assertEditor();
  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "PAID", method: method || undefined, date: new Date() },
    include: { student: { select: { name: true } } },
  });
  await logAudit("UPDATE", "Оплата", `${payment.student.name} · ${money(payment.amount)} · оплачен`);
  await recalcBalance(payment.studentId);
  revalidatePath("/payments");
  revalidatePath("/students");
  revalidatePath(`/students/${payment.studentId}`);
  revalidatePath("/dashboard");
}

export async function deletePayment(paymentId: string) {
  await assertEditor();
  const payment = await prisma.payment.delete({ where: { id: paymentId }, include: { student: { select: { name: true } } } });
  await logAudit("DELETE", "Оплата", `${payment.student.name} · ${money(payment.amount)}`);
  await recalcBalance(payment.studentId);
  revalidatePath("/payments");
  revalidatePath("/students");
  revalidatePath(`/students/${payment.studentId}`);
  revalidatePath("/dashboard");
}
