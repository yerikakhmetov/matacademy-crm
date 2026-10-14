import { prisma } from "./prisma";
import { money } from "./format";
import { getSettings, renderTemplate, DEFAULT_TEMPLATES } from "./settings";
import { lessonsLeftAll } from "./payroll";
import { leftKey, packageAlerts, type PackageAlertItem } from "./packages";

export type ReminderItem = {
  studentName: string;
  parentName: string | null;
  chatId: string | null;
  phone: string | null;
  category: "OVERDUE" | "PENDING" | "PACKAGE";
  message: string; // для Telegram (можно HTML)
  waDetail: string; // одна строка для параметра WhatsApp-шаблона
  short: string; // для сводки админу
  /** PACKAGE: какие пакеты отмечаются как «напомнили» после рассылки */
  notices?: { studentId: string; subjectId: string; total: number }[];
};

export type PackageAlertRow = {
  studentId: string;
  name: string;
  parentName: string | null;
  parentPhone: string | null;
  chatId: string | null;
  items: (PackageAlertItem & { subjectName: string; notifiedAt: Date | null })[];
};

// Ученики, у которых по предметам заканчиваются оплаченные занятия (≤ 2) или они
// ходят без оплаты. Предметы с уже выставленным неоплаченным счётом не попадают —
// по ним напоминают как о счёте. notifiedAt — когда об этом пакете уже писали в Telegram.
export async function collectPackageAlerts(): Promise<PackageAlertRow[]> {
  const [active, open] = await Promise.all([
    prisma.student.findMany({
      where: { status: "ACTIVE", groups: { some: { subjectId: { not: null } } } },
      select: {
        id: true,
        name: true,
        parentName: true,
        parentPhone: true,
        telegramChatId: true,
        groups: { where: { subjectId: { not: null } }, select: { subject: { select: { id: true, name: true } } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.paymentItem.findMany({
      where: { subjectId: { not: null }, payment: { status: { in: ["PENDING", "OVERDUE", "PARTIAL"] } } },
      select: { subjectId: true, payment: { select: { studentId: true } } },
    }),
  ]);
  const openInvoice = new Set(open.map((it) => leftKey(it.payment.studentId, it.subjectId!)));
  const left = await lessonsLeftAll(active.map((s) => s.id));
  const alerts = packageAlerts(
    active.flatMap((s) => s.groups.map((g) => ({ studentId: s.id, subjectId: g.subject!.id }))),
    left,
    openInvoice
  );
  const subjectName = new Map(active.flatMap((s) => s.groups.map((g) => [g.subject!.id, g.subject!.name] as const)));
  const ids = [...alerts.keys()];
  const notices = ids.length ? await prisma.packageNotice.findMany({ where: { studentId: { in: ids } } }) : [];
  const noticeAt = new Map(notices.map((n) => [`${n.studentId}|${n.subjectId}|${n.total}`, n.sentAt]));

  return active
    .filter((s) => alerts.has(s.id))
    .map((s) => ({
      studentId: s.id,
      name: s.name,
      parentName: s.parentName,
      parentPhone: s.parentPhone,
      chatId: s.telegramChatId,
      items: alerts.get(s.id)!.map((it) => ({
        ...it,
        subjectName: subjectName.get(it.subjectId) ?? "",
        notifiedAt: noticeAt.get(`${s.id}|${it.subjectId}|${it.total}`) ?? null,
      })),
    }));
}

export const packageItemText = (it: { subjectName: string; left: number; unpaid: number }) =>
  it.unpaid > 0 ? `${it.subjectName}: без оплаты ${it.unpaid} зан.` : `${it.subjectName}: осталось ${it.left} зан.`;

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

  // Пакеты: только те, о которых ещё не писали (одно напоминание на каждую оплату)
  const tplPackage = settings.tplExpiring || DEFAULT_TEMPLATES.expiring;
  for (const row of await collectPackageAlerts()) {
    const fresh = row.items.filter((it) => !it.notifiedAt);
    if (fresh.length === 0) continue;
    const lessons = fresh.map(packageItemText).join("; ");
    items.push({
      studentName: row.name,
      parentName: row.parentName,
      chatId: row.chatId,
      phone: row.parentPhone,
      category: "PACKAGE",
      short: `Заканчиваются занятия: ${row.name} — ${lessons}`,
      waDetail: `заканчиваются оплаченные занятия (${lessons})`,
      message: renderTemplate(tplPackage, { school: SCHOOL, name: row.name, lessons }),
      notices: fresh.map((it) => ({ studentId: row.studentId, subjectId: it.subjectId, total: it.total })),
    });
  }

  return items;
}
