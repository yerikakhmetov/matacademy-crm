// Отправка напоминаний через WhatsApp Cloud API (Meta).
// Бизнес-инициированные сообщения WhatsApp разрешает только по одобренному шаблону.
const VERSION = "v21.0";

export function whatsappConfigured(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

export function normalizePhone(phone: string | null): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

// Отправить шаблон с двумя параметрами {{1}} и {{2}}.
export async function sendWhatsappTemplate(toDigits: string, param1: string, param2: string): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return false;
  const template = process.env.WHATSAPP_TEMPLATE || "payment_reminder";
  const lang = process.env.WHATSAPP_TEMPLATE_LANG || "ru";

  try {
    const res = await fetch(`https://graph.facebook.com/${VERSION}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toDigits,
        type: "template",
        template: {
          name: template,
          language: { code: lang },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: param1 },
                { type: "text", text: param2 },
              ],
            },
          ],
        },
      }),
    });
    const data = await res.json();
    return Array.isArray(data.messages) && data.messages.length > 0;
  } catch {
    return false;
  }
}
