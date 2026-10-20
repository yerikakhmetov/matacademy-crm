"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { parseCareerLinks } from "@/lib/career-test";
import { UserError } from "./_shared";

// ---------- Профориентация (MentorHub) ----------
// Админ/менеджер вставляет список из MentorHub — личные ссылки раскладываются по ученикам.

async function assertEditor() {
  const session = await auth();
  if (!session?.user || !(await canEditData(session.user.role))) throw new UserError("Недостаточно прав");
}

export type CareerImportResult = { error?: string; saved?: number; unmatched?: string[] };

export async function importCareerLinks(text: string): Promise<CareerImportResult> {
  try {
    await assertEditor();
    if (!text.trim()) throw new UserError("Вставьте список из MentorHub");
    const students = await prisma.student.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, phone: true },
    });
    const { matched, unmatched } = parseCareerLinks(text, students);
    await prisma.$transaction(
      matched.map((m) => prisma.student.update({ where: { id: m.studentId }, data: { careerTestUrl: m.url } })),
    );
    if (matched.length) await logAudit("UPDATE", "Профориентация", `ссылки на тест: ${matched.length} уч.`);
    revalidatePath("/career-test");
    return { saved: matched.length, unmatched };
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
}

export async function clearCareerLink(studentId: string): Promise<void> {
  await assertEditor();
  await prisma.student.update({ where: { id: studentId }, data: { careerTestUrl: null } });
  revalidatePath("/career-test");
}
