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

  try {
  const msg = update.message;
  const chatId = msg?.chat?.id;
  const text = (msg?.text ?? "").trim();

  if (!chatId) return Response.json({ ok: true });
  const chat = String(chatId);

  if (text.startsWith("/start")) {
    const payload = text.split(/\s+/)[1] ?? "";
    const fromId = msg?.from?.id ? String(msg.from.id) : chat;

    // Вход преподавателя по одноразовому токену: /start login_<token>
    if (payload.startsWith("login_")) {
      const token = payload.slice("login_".length);
      const user = await prisma.user.findUnique({ where: { telegramUserId: fromId } });
      if (user) {
        await prisma.loginToken.upsert({ where: { token }, create: { token, userId: user.id }, update: { userId: user.id } });
        await sendTelegram(chat, `✅ Вход подтверждён! Вернитесь на страницу входа — вы уже входите.`);
      } else {
        await sendTelegram(chat, `⚠️ Ваш Telegram не привязан к учётной записи. Попросите администратора отправить вам ссылку «Вход по Telegram» из карточки преподавателя.`);
      }
      return Response.json({ ok: true });
    }

    // Привязка входа преподавателя: /start teacherlogin_<teacherId>
    if (payload.startsWith("teacherlogin_")) {
      const teacherId = payload.slice("teacherlogin_".length);
      const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, include: { user: true } });
      if (teacher) {
        // Один Telegram — одна учётная запись. Без этой проверки создание пользователя
        // падало на уникальном telegramUserId, и бот просто молчал.
        const taken = await prisma.user.findUnique({ where: { telegramUserId: fromId }, select: { id: true, name: true } });
        if (taken && taken.id !== teacher.userId) {
          await sendTelegram(
            chat,
            `⚠️ Этот Telegram уже привязан к учётной записи «${taken.name}». Один Telegram нельзя использовать для двух аккаунтов — обратитесь к администратору.`
          );
          return Response.json({ ok: true });
        }

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

    // Вход/регистрация ученика в кабинет: /start slogin_<joinToken>_<token>
    if (payload.startsWith("slogin_")) {
      const rest = payload.slice("slogin_".length);
      const sep = rest.indexOf("_");
      const joinToken = sep >= 0 ? rest.slice(0, sep) : rest;
      const token = sep >= 0 ? rest.slice(sep + 1) : "";
      const student = joinToken ? await prisma.student.findUnique({ where: { joinToken } }) : null;
      if (!student) {
        await sendTelegram(chat, `⚠️ Ссылка недействительна или устарела. Попросите новую ссылку у школы.`);
        return Response.json({ ok: true });
      }
      // Кабинет закрепляется за первым Telegram-аккаунтом, который по нему вошёл.
      if (student.joinTgId && student.joinTgId !== fromId) {
        await sendTelegram(chat, `⚠️ Этот кабинет уже привязан к другому Telegram. Если это ваш кабинет — попросите школу перевыпустить ссылку.`);
        return Response.json({ ok: true });
      }

      let userId = student.userId;
      // Ученик входит по одноразовому токену, telegramUserId ему не нужен
      // (и не должен конфликтовать с аккаунтом преподавателя/админа с тем же Telegram).
      if (!userId) {
        const user = await prisma.user.create({
          data: {
            name: student.name,
            email: `student_${student.id}@matacademy.local`,
            passwordHash: bcrypt.hashSync(randomUUID(), 10),
            role: "STUDENT",
          },
        });
        userId = user.id;
      }
      await prisma.student.update({
        where: { id: student.id },
        data: { userId, joinTgId: student.joinTgId ?? fromId },
      });
      if (token && userId) {
        await prisma.loginToken.upsert({ where: { token }, create: { token, userId }, update: { userId } });
      }
      await sendTelegram(chat, `✅ Готово, ${student.name}! Возвращайтесь на страницу — вход в личный кабинет произойдёт автоматически.`);
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
  } catch (e) {
    // Никогда не отвечаем Telegram 500 — иначе он бесконечно повторяет доставку.
    console.error("Ошибка обработки вебхука Telegram:", e);
  }

  return Response.json({ ok: true });
}
