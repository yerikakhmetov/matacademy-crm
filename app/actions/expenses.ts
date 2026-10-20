"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { money } from "@/lib/format";
import { assertEditor, int, parseDate, str, dateOrToday } from "./_shared";
import { isExpenseCategory, recurringToCopy } from "@/lib/expenses";

// ---------- Расходы школы ----------
async function expenseData(formData: FormData) {
  const title = str(formData.get("title"));
  if (!title) throw new Error("Укажите, за что расход");
  const amount = int(formData.get("amount"));
  if (amount <= 0) throw new Error("Сумма должна быть больше нуля");
  return {
    title,
    amount,
    category: isExpenseCategory(str(formData.get("category"))) ? str(formData.get("category")) : "OTHER",
    date: await dateOrToday(formData.get("date")),
    note: str(formData.get("note")) || null,
    recurring: formData.get("recurring") != null,
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

// Перенести ежемесячные расходы (аренда, коммунальные…) прошлого месяца в выбранный.
// Сумма и название — как в прошлом месяце, дата — тот же день этого месяца; потом можно поправить.
export async function copyRecurringExpenses(year: number, month0: number) {
  await assertEditor("finance");
  const session = await auth();
  const from = new Date(Date.UTC(year, month0 - 1, 1));
  const start = new Date(Date.UTC(year, month0, 1));
  const end = new Date(Date.UTC(year, month0 + 1, 1));
  const [prev, cur] = await Promise.all([
    prisma.expense.findMany({ where: { date: { gte: from, lt: start }, recurring: true } }),
    prisma.expense.findMany({ where: { date: { gte: start, lt: end } }, select: { copiedFromId: true } }),
  ]);
  const todo = recurringToCopy(prev, cur);
  if (todo.length === 0) return;
  const lastDay = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  await prisma.expense.createMany({
    data: todo.map((e) => ({
      title: e.title,
      amount: e.amount,
      category: e.category,
      note: e.note,
      recurring: true,
      copiedFromId: e.id,
      date: new Date(Date.UTC(year, month0, Math.min(e.date.getUTCDate(), lastDay))),
      createdBy: session?.user?.name ?? null,
    })),
  });
  await logAudit("CREATE", "Расход", `перенесены ежемесячные: ${todo.length}`);
  revalidatePath("/expenses");
  revalidatePath("/reports");
}
