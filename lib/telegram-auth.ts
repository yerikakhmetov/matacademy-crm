import crypto from "crypto";

export type TelegramAuthData = Record<string, string> & { id?: string; hash?: string; auth_date?: string };

// Проверка подписи данных Telegram Login Widget.
// https://core.telegram.org/widgets/login#checking-authorization
export function verifyTelegramAuth(data: TelegramAuthData): boolean {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !data.hash) return false;

  const { hash, ...fields } = data;
  const checkString = Object.keys(fields)
    .filter((k) => fields[k] !== undefined && fields[k] !== "")
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");

  const secret = crypto.createHash("sha256").update(token).digest();
  const hmac = crypto.createHmac("sha256", secret).update(checkString).digest("hex");
  if (hmac !== hash) return false;

  // не старше 24 часов
  const authDate = Number(data.auth_date ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > 86400) return false;

  return true;
}
