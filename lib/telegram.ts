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
