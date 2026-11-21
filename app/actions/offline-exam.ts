"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { localDigits } from "@/lib/phone";
import { encryptOfflinePassword, localExamUrl, parseOfflineCredentials, parseOfflineResults } from "@/lib/offline-exam";
import { logAudit } from "@/lib/audit";
import { assertAdmin } from "./_shared";

export type OfflineExamImportState = { error?: string; imported?: number; linked?: number };
export type OfflineResultImportState = { error?: string; imported?: number; linked?: number };

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

  const matched: { student: (typeof students)[number]; row: (typeof credentials)[number] }[] = [];
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

export async function importOfflineExamResults(_: OfflineResultImportState, formData: FormData): Promise<OfflineResultImportState> {
  await assertAdmin();
  const file = formData.get("results");
  if (!(file instanceof File) || file.size === 0 || file.size > 500_000) return { error: "Нәтижелер CSV файлын таңдаңыз (500 КБ-тан аспасын)" };
  const title = String(formData.get("title") ?? "").trim();
  const examKey = String(formData.get("examKey") ?? "").trim();
  const dateText = String(formData.get("date") ?? "").trim();
  if (!title || title.length > 100) return { error: "Тест атауын енгізіңіз" };
  if (!/^[a-z0-9-]{8,80}$/.test(examKey)) return { error: "Тест кілті 8–80 латын әрпі, сан немесе сызықша болуы керек" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText) || Number.isNaN(Date.parse(`${dateText}T00:00:00+05:00`))) return { error: "Күнді дұрыс енгізіңіз" };
  const date = new Date(`${dateText}T12:00:00+05:00`);
  let results: ReturnType<typeof parseOfflineResults>;
  try { results = parseOfflineResults(await file.text()); }
  catch (error) { return { error: error instanceof Error ? error.message : "CSV файлын оқу мүмкін болмады" }; }
  const maxScore = results[0].maxScore;
  if (results.some((row) => row.maxScore !== maxScore)) return { error: "Барлық оқушының максималды ұпайы бірдей болуы керек" };

  const students = await prisma.student.findMany({
    where: { status: "ACTIVE", phone: { not: null } },
    select: { id: true, name: true, phone: true, userId: true },
  });
  const byPhone = new Map<string, (typeof students)[number]>();
  const duplicates = new Set<string>();
  for (const student of students) {
    const digits = localDigits(student.phone ?? "");
    if (!digits) continue;
    if (byPhone.has(digits)) duplicates.add(digits);
    byPhone.set(digits, student);
  }
  const matched: { student: (typeof students)[number]; row: (typeof results)[number] }[] = [];
  for (const row of results) {
    const student = byPhone.get(row.phoneDigits);
    if (!student || duplicates.has(row.phoneDigits)) return { error: `${row.name}: CRM-де телефон табылмады немесе қайталанады` };
    if (comparable(student.name) !== comparable(row.name)) return { error: `${row.name}: аты-жөні CRM-дегі телефон иесіне сәйкес емес` };
    matched.push({ student, row });
  }

  const testId = `offline-${createHash("sha256").update(examKey).digest("hex").slice(0, 32)}`;
  await prisma.$transaction(async (tx) => {
    await tx.test.upsert({
      where: { id: testId },
      create: { id: testId, title, date, maxScore, createdBy: "offline-exam" },
      update: { title, date, maxScore },
    });
    for (const { student, row } of matched) {
      const values = { topic: `${title} · №${row.variant}-нұсқа`, date, type: "EXAM", score: row.score, maxScore: row.maxScore, createdBy: "offline-exam" };
      await tx.grade.upsert({
        where: { testId_studentId: { testId, studentId: student.id } },
        create: { testId, studentId: student.id, ...values },
        update: values,
      });
    }
  });
  await logAudit("CREATE", "Офлайн тест нәтижелері", `${title} · ${matched.length} оқушының ұпайы енгізілді`);
  revalidatePath("/cabinet");
  revalidatePath("/offline-test");
  return { imported: matched.length, linked: matched.filter(({ student }) => student.userId).length };
}
