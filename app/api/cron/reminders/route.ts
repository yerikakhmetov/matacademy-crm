import { NextRequest } from "next/server";
import { collectReminders } from "@/lib/reminders";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";
import { sendWhatsappTemplate, whatsappConfigured, normalizePhone } from "@/lib/whatsapp";
import { markOverdue } from "@/lib/overdue";

export const dynamic = "force-dynamic";

// Ежедневная авто-рассылка напоминаний в Telegram.
// Запускается Vercel Cron (см. vercel.json) или вручную с секретом.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const q = req.nextUrl.searchParams.get("secret");
    if (auth !== `Bearer ${secret}` && q !== secret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  await markOverdue();
  const items = await collectReminders();

  const tg = telegramConfigured();
  const wa = whatsappConfigured();
  if (!tg && !wa) {
    return Response.json({ ok: false, reason: "Не настроен ни один канал (Telegram/WhatsApp)", reminders: items.length });
  }

  const debug = req.nextUrl.searchParams.get("debug") === "1";
  const waErrors: string[] = [];

  // Приоритет: Telegram (если привязан), иначе WhatsApp (если есть телефон и настроен)
  let sentTelegram = 0;
  let sentWhatsapp = 0;
  let unreachable = 0;
  for (const it of items) {
    if (tg && it.chatId) {
      if (await sendTelegram(it.chatId, it.message)) sentTelegram++;
      continue;
    }
    const digits = normalizePhone(it.phone);
    if (wa && digits) {
      const r = await sendWhatsappTemplate(digits, it.studentName, it.waDetail);
      if (r.ok) sentWhatsapp++;
      else if (r.error) waErrors.push(r.error);
      continue;
    }
    unreachable++;
  }

  // Сводка администратору школы (в Telegram)
  const adminChat = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (tg && adminChat && items.length > 0) {
    const lines = items.map((i) => `• ${i.short}`);
    const digest = `📋 <b>Напоминания на сегодня</b> (${items.length})\n\nTelegram: ${sentTelegram} · WhatsApp: ${sentWhatsapp} · без канала: ${unreachable}\n\n${lines.join("\n")}`;
    await sendTelegram(adminChat, digest);
  }

  return Response.json({
    ok: true,
    total: items.length,
    sentTelegram,
    sentWhatsapp,
    unreachable,
    ...(debug ? { waErrors } : {}),
  });
}
