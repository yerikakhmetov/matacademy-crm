import { prisma } from "./prisma";
import { money, formatDate, subStatus } from "./format";

const SCHOOL = "МатАкадемии";

export type ReminderItem = {
  studentName: string;
  parentName: string | null;
  chatId: string | null;
  phone: string | null;
  category: "OVERDUE" | "PENDING" | "EXPIRING";
  message: string; // для Telegram (можно HTML)
  waDetail: string; // одна строка для параметра WhatsApp-шаблона
  short: string; // для сводки админу
};

// Собрать все актуальные напоминания (долги, ожидающие счета, истекающие абонементы)
export async function collectReminders(): Promise<ReminderItem[]> {
  const [overdue, pending, subs] = await Promise.all([
    prisma.payment.findMany({ where: { status: "OVERDUE" }, include: { student: true }, orderBy: { date: "asc" } }),
    prisma.payment.findMany({ where: { status: "PENDING" }, include: { student: true }, orderBy: { date: "asc" } }),
    prisma.subscription.findMany({ where: { endDate: { not: null } }, include: { student: true }, orderBy: { endDate: "desc" } }),
  ]);

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
      message: `⚠️ Напоминание об оплате\n\nЗдравствуйте! У ученика <b>${p.student.name}</b> есть задолженность за обучение в ${SCHOOL}: «${p.purpose}» — <b>${money(p.amount)}</b>. Просрочено на ${days} дн. Просьба оплатить при первой возможности. Спасибо!`,
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
      message: `💳 Напоминание об оплате\n\nЗдравствуйте! Для ученика <b>${p.student.name}</b> выставлен счёт в ${SCHOOL}: «${p.purpose}» — <b>${money(p.amount)}</b>. Ждём оплату. Спасибо!`,
    });
  }

  const seen = new Set<string>();
  for (const s of subs) {
    if (seen.has(s.studentId)) continue;
    seen.add(s.studentId);
    const ss = subStatus(s.endDate);
    if (ss.daysLeft == null || ss.daysLeft > 14) continue;
    const expired = ss.daysLeft < 0;
    items.push({
      studentName: s.student.name,
      parentName: s.student.parentName,
      chatId: s.student.telegramChatId,
      phone: s.student.parentPhone,
      category: "EXPIRING",
      short: `Абонемент ${expired ? "истёк" : "истекает"}: ${s.student.name} (${s.plan})`,
      waDetail: expired ? `абонемент «${s.plan}» истёк ${formatDate(s.endDate!)}` : `абонемент «${s.plan}» истекает ${formatDate(s.endDate!)}`,
      message: expired
        ? `📅 Абонемент истёк\n\nЗдравствуйте! Абонемент «${s.plan}» ученика <b>${s.student.name}</b> истёк ${formatDate(s.endDate!)}. Готовы продлить? Будем рады видеть вас в ${SCHOOL}!`
        : `📅 Абонемент заканчивается\n\nЗдравствуйте! Абонемент «${s.plan}» ученика <b>${s.student.name}</b> истекает ${formatDate(s.endDate!)}. Предлагаем продлить заранее. Спасибо, что вы с ${SCHOOL}!`,
    });
  }

  return items;
}
