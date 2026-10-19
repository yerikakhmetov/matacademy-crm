"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { getSettings, renderTemplate, DEFAULT_TEMPLATES } from "@/lib/settings";
import { notifyParent, notifyStudentsDirect } from "@/lib/notify";
import { assertCanManageGroup, assertStudentInGroup, int, parseDate, str, dateOrToday, UserError, asResult } from "./_shared";
import { parseBulkScores } from "@/lib/grade-bulk";

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
  // группа оценки — своя и ученика: иначе оценка всплыла бы в чужой группе
  if (gradeGroupId) {
    await assertCanManageGroup(gradeGroupId);
    await assertStudentInGroup(studentId, gradeGroupId);
  }
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
      date: await dateOrToday(formData.get("date")),
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

// Оценки всей группе за раз (например, ДЗ): тема, вид, дата и максимум общие,
// балл — у каждого ученика в поле «score_<id>». Пустое поле — ученик пропущен.
export async function addGradesBulk(groupId: string, formData: FormData) {
  return asResult(async () => {
    const session = await assertCanManageGroup(groupId);
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { students: { select: { id: true, name: true } } },
    });
    if (!group) throw new UserError("Группа не найдена");
    const topic = str(formData.get("topic"));
    if (!topic) throw new UserError("Укажите, за что оценки");
    const type = str(formData.get("type")) || "HOMEWORK";
    const maxScore = Math.max(1, int(formData.get("maxScore")) || 10);
    const raw: Record<string, string> = {};
    for (const s of group.students) raw[s.id] = String(formData.get(`score_${s.id}`) ?? "");
    const { scores, error } = parseBulkScores(raw, group.students, maxScore);
    if (error) throw new UserError(error);
    if (scores.length === 0) throw new UserError("Введите балл хотя бы одному ученику");

    const date = await dateOrToday(formData.get("date"));
    await prisma.grade.createMany({
      data: scores.map((x) => ({
        studentId: x.studentId,
        groupId,
        topic,
        type,
        score: x.score,
        maxScore,
        date,
        createdBy: session.user?.name ?? null,
      })),
    });
    await logAudit("CREATE", "Оценка", `${topic} · группе, ${scores.length} уч.`);

    const st = await getSettings();
    if (st.notifyGrade) {
      const names = new Map(group.students.map((s) => [s.id, s.name]));
      await Promise.allSettled(
        scores.map(async (x) => {
          const text = renderTemplate(st.tplGrade || DEFAULT_TEMPLATES.grade, {
            school: st.schoolName,
            name: names.get(x.studentId) ?? "",
            topic,
            score: x.score,
            max: maxScore,
            pct: Math.round((x.score / maxScore) * 100),
          });
          await notifyParent(x.studentId, text);
          if (st.notifyStudent) await notifyStudentsDirect([x.studentId], text);
        }),
      );
    }
    revalidatePath("/grades");
  });
}
