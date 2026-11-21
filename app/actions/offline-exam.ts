"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { localDigits } from "@/lib/phone";
import { encryptOfflinePassword, localExamUrl, parseOfflineCredentials } from "@/lib/offline-exam";
import { logAudit } from "@/lib/audit";
import { assertAdmin } from "./_shared";

export type OfflineExamImportState = { error?: string; imported?: number; linked?: number };

const comparable = (value: string) => value.normalize("NFKC").toLocaleLowerCase("kk-KZ").replace(/\s+/g, " ").trim();
const groupCode = (value: string) => comparable(value).toUpperCase().replaceAll("М", "M").replaceAll("–", "-").replaceAll("—", "-");

export async function importOfflineExamAccess(_: OfflineExamImportState, formData: FormData): Promise<OfflineExamImportState> {
  await assertAdmin();
  const file = formData.get("credentials");
  if (!(file instanceof File) || file.size === 0 || file.size > 200_000) return { error: "Құпия сөздер CSV файлын таңдаңыз (200 КБ-тан аспасын)" };
  const title = String(formData.get("title") ?? "").trim();
  if (!title || title.length > 100) return { error: "Тест атауын енгізіңіз" };
  let url: string;
  let credentials: ReturnType<typeof parseOfflineCredentials>;
  try {
    url = localExamUrl(String(formData.get("url") ?? ""));
    credentials = parseOfflineCredentials(await file.text());
  } catch (error) {
    return { error: error instanceof Error ? error.message : "CSV файлын оқу мүмкін болмады" };
  }
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET орнатылмаған");

  const students = await prisma.student.findMany({
    where: { status: "ACTIVE", phone: { not: null } },
    select: { id: true, name: true, phone: true, userId: true, groups: { select: { name: true } } },
  });
  const byPhone = new Map<string, (typeof students)[number]>();
  const duplicatePhones = new Set<string>();
  for (const student of students) {
    const digits = localDigits(student.phone ?? "");
    if (!digits) continue;
    if (byPhone.has(digits)) duplicatePhones.add(digits);
    byPhone.set(digits, student);
  }

  const matched = [];
  for (const row of credentials) {
    const student = byPhone.get(row.phoneDigits);
    if (!student || duplicatePhones.has(row.phoneDigits)) return { error: `CRM-де ${row.name} оқушысының телефон нөмірі табылмады немесе қайталанады` };
    if (comparable(student.name) !== comparable(row.name)) return { error: `${row.name}: аты-жөні CRM-дегі телефон иесіне сәйкес емес` };
    if (row.group && !student.groups.some((group) => groupCode(group.name) === groupCode(row.group))) {
      return { error: `${row.name}: тобы CRM дерегімен сәйкес емес` };
    }
    matched.push({ student, row });
  }

  // Барлық жазба алдын ала тексеріледі; бір қате болса ешкімнің коды өзгермейді.
  await prisma.$transaction(matched.map(({ student, row }) => prisma.student.update({
    where: { id: student.id },
    data: { offlineTestTitle: title, offlineTestUrl: url, offlineTestSecret: encryptOfflinePassword(row.password, secret) },
  })));
  await logAudit("UPDATE", "Офлайн тест", `${title} · ${matched.length} оқушыға жеке кіру дерегі берілді`);
  revalidatePath("/cabinet");
  revalidatePath("/offline-test");
  return { imported: matched.length, linked: matched.filter(({ student }) => student.userId).length };
}
