import { prisma } from "./prisma";
import { money } from "./format";
import { getSettings, renderTemplate, DEFAULT_TEMPLATES } from "./settings";

export type ReminderItem = {
  studentName: string;
  parentName: string | null;
  chatId: string | null;
  phone: string | null;
  category: "OVERDUE" | "PENDING";
  message: string; // для Telegram (можно HTML)
  waDetail: string; // одна строка для параметра WhatsApp-шаблона
  short: string; // для сводки админу
};

// Собрать все актуальные напоминания (долги и ожидающие счета)
export async function collectReminders(): Promise<ReminderItem[]> {
  const [overdue, pending, settings] = await Promise.all([
    prisma.payment.findMany({ where: { status: "OVERDUE" }, include: { student: true }, orderBy: { date: "asc" } }),
    prisma.payment.findMany({ where: { status: "PENDING" }, include: { student: true }, orderBy: { date: "asc" } }),
    getSettings(),
  ]);

  const SCHOOL = settings.schoolName || "школы";
  const tplOverdue = settings.tplOverdue || DEFAULT_TEMPLATES.overdue;
  const tplPending = settings.tplPending || DEFAULT_TEMPLATES.pending;

  const items: ReminderItem[] = [];

  for (const p of overdue) {
    const days = Math.max(1, Math.floor((Date.now() - p.date.getTime()) / 86400000));
    items.push({
      studentName: p.student.name,
      parentName: p.student.parentName,
      chatId: p.student.telegramChatId,
      phone: p.student.parentPhone,
      category: "OVERDUE",
      short: `Долг: ${p.student.name} — ${money(p.amount)} (просрочено ${days} дн.)`,
      waDetail: `задолженность «${p.purpose}» — ${money(p.amount)}, просрочено ${days} дн.`,
      message: renderTemplate(tplOverdue, { school: SCHOOL, name: p.student.name, purpose: p.purpose, amount: money(p.amount), days }),
    });
  }

  for (const p of pending) {
    items.push({
      studentName: p.student.name,
      parentName: p.student.parentName,
      chatId: p.student.telegramChatId,
      phone: p.student.parentPhone,
      category: "PENDING",
      short: `Ожидает оплаты: ${p.student.name} — ${money(p.amount)}`,
      waDetail: `счёт «${p.purpose}» на ${money(p.amount)} ожидает оплаты`,
      message: renderTemplate(tplPending, { school: SCHOOL, name: p.student.name, purpose: p.purpose, amount: money(p.amount) }),
    });
  }

  return items;
}
