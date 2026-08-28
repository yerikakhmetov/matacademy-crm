// Отправка сообщений через Telegram Bot API.
const API = (method: string) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

export function telegramConfigured(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN;
}

export async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return false;
  try {
    const res = await fetch(API("sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    const data = await res.json();
    return !!data.ok;
  } catch {
    return false;
  }
}
