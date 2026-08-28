import { NextRequest } from "next/server";
import { collectReminders } from "@/lib/reminders";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";
import { refreshOverdue } from "@/app/actions/data";

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

  await refreshOverdue();
  const items = await collectReminders();

  if (!telegramConfigured()) {
    return Response.json({ ok: false, reason: "TELEGRAM_BOT_TOKEN не задан", reminders: items.length });
  }

  // Персональные напоминания родителям (у кого привязан Telegram)
  let sent = 0;
  let unlinked = 0;
  for (const it of items) {
    if (it.chatId) {
      const ok = await sendTelegram(it.chatId, it.message);
      if (ok) sent++;
    } else {
      unlinked++;
    }
  }

  // Сводка администратору школы
  const adminChat = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (adminChat && items.length > 0) {
    const lines = items.map((i) => `• ${i.short}${i.chatId ? "" : " (Telegram не привязан)"}`);
    const digest = `📋 <b>Напоминания на сегодня</b> (${items.length})\n\nОтправлено родителям: ${sent}\nБез Telegram: ${unlinked}\n\n${lines.join("\n")}`;
    await sendTelegram(adminChat, digest);
  }

  return Response.json({ ok: true, total: items.length, sent, unlinked });
}
