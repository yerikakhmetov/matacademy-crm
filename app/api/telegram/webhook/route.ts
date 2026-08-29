import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// Вебхук Telegram: ловит /start <studentId> и привязывает чат родителя к ученику.
export async function POST(req: NextRequest) {
  // Необязательная защита: секрет в заголовке (устанавливается при setWebhook)
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return Response.json({ ok: false }, { status: 401 });
  }

  let update: {
    message?: { chat?: { id?: number | string }; text?: string; from?: { first_name?: string; id?: number | string } };
  };
  try {
    update = await req.json();
  } catch {
    return Response.json({ ok: true });
  }

  const msg = update.message;
  const chatId = msg?.chat?.id;
  const text = (msg?.text ?? "").trim();

  if (!chatId) return Response.json({ ok: true });
  const chat = String(chatId);

  if (text.startsWith("/start")) {
    const payload = text.split(/\s+/)[1] ?? "";
    const fromId = msg?.from?.id ? String(msg.from.id) : chat;

    // Привязка входа преподавателя: /start teacherlogin_<teacherId>
    if (payload.startsWith("teacherlogin_")) {
      const teacherId = payload.slice("teacherlogin_".length);
      const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, include: { user: true } });
      if (teacher) {
        let userId = teacher.userId;
        // если у преподавателя ещё нет учётной записи — создаём (вход только через Telegram)
        if (!userId) {
          const user = await prisma.user.create({
            data: {
              name: teacher.name,
              email: `telegram_${teacher.id}@matacademy.local`,
              passwordHash: bcrypt.hashSync(randomUUID(), 10),
              role: "TEACHER",
              telegramUserId: fromId,
            },
          });
          await prisma.teacher.update({ where: { id: teacher.id }, data: { userId: user.id } });
        } else {
          await prisma.user.update({ where: { id: userId }, data: { telegramUserId: fromId } });
        }
        await sendTelegram(
          chat,
          `✅ Готово, ${teacher.name}! Теперь входите в CRM МатАкадемии кнопкой «Войти через Telegram» на странице входа.`
        );
      } else {
        await sendTelegram(chat, `⚠️ Преподаватель не найден. Обратитесь к администратору.`);
      }
      return Response.json({ ok: true });
    }

    const studentId = payload;
    if (studentId) {
      const student = await prisma.student.findUnique({ where: { id: studentId } });
      if (student) {
        await prisma.student.update({ where: { id: studentId }, data: { telegramChatId: chat } });
        await sendTelegram(
          chat,
          `✅ Готово! Вы подписались на уведомления МатАкадемии по ученику <b>${student.name}</b>.\n\nЗдесь вы будете получать напоминания об оплате и об окончании абонемента.`
        );
        return Response.json({ ok: true });
      }
    }
    await sendTelegram(
      chat,
      `👋 Здравствуйте! Это бот уведомлений МатАкадемии.\n\nЧтобы получать напоминания, откройте персональную ссылку-приглашение, которую выдаёт администратор школы в карточке ученика.`
    );
  }

  return Response.json({ ok: true });
}
