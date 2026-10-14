"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { money } from "@/lib/format";
import { assertEditor, int, parseDate, str, dateOrToday } from "./_shared";

// ---------- Расходы школы ----------
async function expenseData(formData: FormData) {
  const title = str(formData.get("title"));
  if (!title) throw new Error("Укажите, за что расход");
  const amount = int(formData.get("amount"));
  if (amount <= 0) throw new Error("Сумма должна быть больше нуля");
  return {
    title,
    amount,
    category: str(formData.get("category")) || "OTHER",
    date: await dateOrToday(formData.get("date")),
    note: str(formData.get("note")) || null,
  };
}

export async function createExpense(formData: FormData) {
  await assertEditor("finance");
  const session = await auth();
  const data = await expenseData(formData);
  await prisma.expense.create({ data: { ...data, createdBy: session?.user?.name ?? null } });
  await logAudit("CREATE", "Расход", `${data.title} · ${money(data.amount)}`);
  revalidatePath("/expenses");
  revalidatePath("/reports");
}

export async function updateExpense(id: string, formData: FormData) {
  await assertEditor("finance");
  const data = await expenseData(formData);
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
