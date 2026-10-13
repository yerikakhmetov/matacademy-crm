// Отправка сообщений через Telegram Bot API.
const API = (method: string) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

export function telegramConfigured(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN;
}

// button — необязательная кнопка-ссылка под сообщением: ученику не нужно
// возвращаться на открытую вкладку, вход работает прямо из чата.
export async function sendTelegram(
  chatId: string,
  text: string,
  button?: { text: string; url: string }
): Promise<boolean> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return false;
  try {
    const res = await fetch(API("sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(button ? { reply_markup: { inline_keyboard: [[{ text: button.text, url: button.url }]] } } : {}),
      }),
    });
    const data = await res.json();
    return !!data.ok;
  } catch {
    return false;
  }
}

// Сообщение с кнопками-ответами (callback): нажатие приходит в вебхук как callback_query
// с этим data. Telegram ограничивает data 64 байтами.
export async function sendTelegramChoices(
  chatId: string,
  text: string,
  choices: { text: string; data: string }[]
): Promise<boolean> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return false;
  try {
    const res = await fetch(API("sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: [choices.map((c) => ({ text: c.text, callback_data: c.data }))] },
      }),
    });
    const data = await res.json();
    return !!data.ok;
  } catch {
    return false;
  }
}

// Ответ на нажатие кнопки: убирает «часики» на кнопке и заменяет текст сообщения,
// чтобы по старому сообщению нельзя было нажать ещё раз.
export async function settleTelegramChoice(
  callbackId: string,
  chatId: string | null,
  messageId: number | null,
  text: string
): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(API("answerCallbackQuery"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackId }),
    });
    if (chatId && messageId) {
      await fetch(API("editMessageText"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: "HTML" }),
      });
    }
  } catch {
    /* сеть до Telegram: пользователь увидит результат на сайте */
  }
}
