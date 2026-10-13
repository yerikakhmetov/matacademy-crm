"use server";

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sendTelegram } from "@/lib/telegram";
import { assertEditor, str } from "./_shared";

// ---------- Рассылка родителям ----------
export async function broadcastTelegram(formData: FormData): Promise<{ sent: number; total: number; error?: string }> {
  await assertEditor();
  const text = str(formData.get("text"));
  if (!text) return { sent: 0, total: 0, error: "Введите текст сообщения" };
  const group = str(formData.get("group"));

  const students = await prisma.student.findMany({
    where: {
      telegramChatId: { not: null },
      ...(group && group !== "all" ? { groups: { some: { id: group } } } : {}),
    },
    select: { telegramChatId: true },
  });

  if (students.length === 0) return { sent: 0, total: 0, error: "Нет родителей с подключённым Telegram" };

  const message = `📣 <b>Сообщение от школы</b>\n\n${text}`;
  let sent = 0;
  for (const s of students) {
    if (s.telegramChatId && (await sendTelegram(s.telegramChatId, message))) sent++;
  }
  await logAudit("CREATE", "Рассылка", `${sent}/${students.length} родителям`);
  return { sent, total: students.length };
}
