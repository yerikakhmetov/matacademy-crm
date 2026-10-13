"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { normalizePhoneOrNull } from "@/lib/phone";
import { assertEditor, newToken, parseDate, str } from "./_shared";

// ---------- Лиды ----------
export async function createLead(formData: FormData) {
  await assertEditor("leads");
  await prisma.lead.create({
    data: {
      name: str(formData.get("name")),
      childName: str(formData.get("childName")) || null,
      phone: normalizePhoneOrNull(str(formData.get("phone"))),
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
      phone: normalizePhoneOrNull(str(formData.get("phone"))),
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
