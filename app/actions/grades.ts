"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { getSettings, renderTemplate, DEFAULT_TEMPLATES } from "@/lib/settings";
import { notifyParent, notifyStudentsDirect } from "@/lib/notify";
import { int, parseDate, str } from "./_shared";

// ---------- Оценки ----------
// Ставить оценку может админ/менеджер или учитель группы ученика.
async function assertCanGrade(studentId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Требуется вход");
  if (await canEditData(session.user.role)) return session;
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { groups: { include: { teacher: true } } },
  });
  if (session.user.role === "TEACHER" && student?.groups.some((g) => g.teacher?.userId === session.user.id)) return session;
  throw new Error("Недостаточно прав");
}

export async function addGrade(studentId: string, formData: FormData) {
  const session = await assertCanGrade(studentId);
  // За какую группу оценка: страница «Успеваемость» всегда открыта на конкретной
  // группе. Без этого оценка всплывала бы во всех группах ученика.
  const gradeGroupId = str(formData.get("groupId")) || null;
  const score = int(formData.get("score"));
  const maxScore = Math.max(1, int(formData.get("maxScore")) || 100);
  await prisma.grade.create({
    data: {
      studentId,
      topic: str(formData.get("topic")) || "Оценка",
      type: str(formData.get("type")) || "TEST",
      score,
      maxScore,
      comment: str(formData.get("comment")) || null,
      date: parseDate(formData.get("date")) ?? new Date(),
      createdBy: session.user?.name ?? null,
      groupId: gradeGroupId,
    },
  });
  await logAudit("CREATE", "Оценка", `${score}/${maxScore} · ${str(formData.get("topic"))}`);

  const st = await getSettings();
  if (st.notifyGrade) {
    const stu = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } });
    const gradeText = renderTemplate(st.tplGrade || DEFAULT_TEMPLATES.grade, {
        school: st.schoolName,
        name: stu?.name ?? "",
        topic: str(formData.get("topic")) || "Оценка",
        score,
        max: maxScore,
        pct: Math.round((score / maxScore) * 100),
    });
    await notifyParent(studentId, gradeText);
    if (st.notifyStudent) await notifyStudentsDirect([studentId], gradeText);
  }

  revalidatePath("/grades");
  revalidatePath(`/students/${studentId}`);
}

export async function deleteGrade(id: string) {
  const grade = await prisma.grade.findUnique({ where: { id } });
  if (!grade) return;
  await assertCanGrade(grade.studentId);
  await prisma.grade.delete({ where: { id } });
  await logAudit("DELETE", "Оценка", `${grade.score}/${grade.maxScore} · ${grade.topic}`);
  revalidatePath("/grades");
  revalidatePath(`/students/${grade.studentId}`);
}
