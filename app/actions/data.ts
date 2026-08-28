"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEdit } from "@/lib/roles";

async function assertEditor() {
  const session = await auth();
  if (!session?.user) throw new Error("Требуется вход");
  if (!canEdit(session.user.role)) throw new Error("Недостаточно прав");
}

const str = (v: FormDataEntryValue | null) => (v == null ? "" : String(v).trim());
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
  await prisma.student.create({
    data: {
      name: str(formData.get("name")),
      grade: str(formData.get("grade")) || null,
      phone: str(formData.get("phone")) || null,
      parentName: str(formData.get("parentName")) || null,
      parentPhone: str(formData.get("parentPhone")) || null,
      groupId: str(formData.get("groupId")) || null,
      status: str(formData.get("status")) || "ACTIVE",
      attendance: 90,
    },
  });
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
  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
}

export async function deleteStudent(id: string) {
  await assertEditor();
  await prisma.student.delete({ where: { id } });
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
    },
  });
  revalidatePath("/groups");
}

// ---------- Учителя ----------
export async function createTeacher(formData: FormData) {
  await assertEditor();
  await prisma.teacher.create({
    data: {
      name: str(formData.get("name")),
      specialty: str(formData.get("specialty")),
      phone: str(formData.get("phone")) || null,
      color: str(formData.get("color")) || "#3A5AE0",
    },
  });
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
      stage: "NEW",
    },
  });
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

  await prisma.student.create({
    data: {
      name: str(formData.get("name")) || lead.childName || lead.name,
      grade: str(formData.get("grade")) || lead.grade || null,
      groupId: str(formData.get("groupId")) || null,
      phone: lead.phone,
      parentName: lead.name,
      parentPhone: lead.phone,
      status: "ACTIVE",
      attendance: 100,
    },
  });
  await prisma.lead.update({ where: { id: leadId }, data: { stage: "WON" } });

  revalidatePath("/leads");
  revalidatePath("/students");
  revalidatePath("/dashboard");
}

// ---------- Абонементы ----------
export async function createSubscription(studentId: string, formData: FormData) {
  await assertEditor();
  const plan = str(formData.get("plan")) || "Абонемент";
  const months = int(formData.get("months")) || 1;
  const price = int(formData.get("price"));
  const start = parseDate(formData.get("startDate")) ?? new Date();
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + months);

  await prisma.subscription.create({
    data: { studentId, plan, months, price, startDate: start, endDate: end, status: "ACTIVE" },
  });

  // Автоматически выставляем счёт на оплату абонемента
  const withInvoice = str(formData.get("invoice")) === "on";
  if (withInvoice && price > 0) {
    await prisma.payment.create({
      data: { studentId, purpose: `Абонемент · ${plan}`, amount: price, status: "PENDING", date: start },
    });
    await recalcBalance(studentId);
  }

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
  await prisma.lesson.create({
    data: {
      groupId,
      dayOfWeek: int(formData.get("dayOfWeek")) || 1,
      startTime: str(formData.get("startTime")) || "16:00",
      room: str(formData.get("room")) || "Каб. 1",
    },
  });
  revalidatePath("/schedule");
  revalidatePath("/dashboard");
}

export async function deleteLesson(id: string) {
  await assertEditor();
  await prisma.lesson.delete({ where: { id } });
  revalidatePath("/schedule");
}

// ---------- Посещаемость ----------
export async function saveAttendance(lessonId: string, dateStr: string, formData: FormData) {
  await assertEditor();
  const date = new Date(dateStr + "T00:00:00.000Z");

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { group: { include: { students: true } } },
  });
  if (!lesson) throw new Error("Занятие не найдено");

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

// ---------- Оплаты ----------
export async function createPayment(formData: FormData) {
  await assertEditor();
  const studentId = str(formData.get("studentId"));
  if (!studentId) throw new Error("Выберите ученика");
  const amount = int(formData.get("amount"));
  await prisma.payment.create({
    data: {
      studentId,
      purpose: str(formData.get("purpose")) || "Оплата",
      method: str(formData.get("method")) || null,
      amount,
      status: str(formData.get("status")) || "PAID",
    },
  });
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
  });
  await recalcBalance(payment.studentId);
  revalidatePath("/payments");
  revalidatePath("/students");
  revalidatePath(`/students/${payment.studentId}`);
  revalidatePath("/dashboard");
}

export async function deletePayment(paymentId: string) {
  await assertEditor();
  const payment = await prisma.payment.delete({ where: { id: paymentId } });
  await recalcBalance(payment.studentId);
  revalidatePath("/payments");
  revalidatePath("/students");
  revalidatePath(`/students/${payment.studentId}`);
  revalidatePath("/dashboard");
}
