"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import { getSettings, renderTemplate, DEFAULT_TEMPLATES } from "@/lib/settings";
import { notifyParents, notifyStudentsDirect } from "@/lib/notify";
import { recalcAttendance } from "@/lib/attendance";
import { isCuratorOfGroup } from "@/lib/curator";
import { UserError, asResult, assertEditor, assertStudentInGroup, int, parseDate, str } from "./_shared";

// ---------- Расписание ----------
export async function createLesson(formData: FormData) {
  await assertEditor();
  const groupId = str(formData.get("groupId"));
  if (!groupId) throw new Error("Выберите группу");
  const lesson = await prisma.lesson.create({
    data: {
      groupId,
      dayOfWeek: int(formData.get("dayOfWeek")) || 1,
      startTime: str(formData.get("startTime")) || "16:00",
      room: str(formData.get("room")) || "Каб. 1",
    },
    include: { group: { select: { name: true } } },
  });
  await logAudit("CREATE", "Занятие", `${lesson.group.name} · ${lesson.startTime}`);
  revalidatePath("/schedule");
  revalidatePath("/dashboard");
}

export async function updateLesson(id: string, formData: FormData) {
  await assertEditor();
  const lesson = await prisma.lesson.update({
    where: { id },
    data: {
      groupId: str(formData.get("groupId")) || undefined,
      dayOfWeek: int(formData.get("dayOfWeek")) || 1,
      startTime: str(formData.get("startTime")) || "16:00",
      room: str(formData.get("room")) || "Каб. 1",
    },
    include: { group: { select: { name: true } } },
  });
  await logAudit("UPDATE", "Занятие", `${lesson.group.name} · ${lesson.startTime}`);
  revalidatePath("/schedule");
  revalidatePath(`/schedule/${id}`);
}

export async function deleteLesson(id: string) {
  await assertEditor();
  const lesson = await prisma.lesson.delete({ where: { id }, include: { group: { select: { name: true } } } });
  await logAudit("DELETE", "Занятие", `${lesson.group.name} · ${lesson.startTime}`);
  revalidatePath("/schedule");
}

// ---------- Отработки ----------
// Право такое же, как на отметку посещаемости: админ/менеджер или учитель этой группы.
async function assertCanMarkLesson(lessonId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Требуется вход");
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { group: { include: { teacher: true } } },
  });
  if (!lesson) throw new Error("Занятие не найдено");
  const owns = lesson.group.teacher?.userId === session.user.id;
  if (!(await canEditData(session.user.role)) && !owns) throw new Error("Недостаточно прав");
  return { session, lesson };
}

export async function scheduleMakeup(formData: FormData) {
  const lessonId = str(formData.get("lessonId"));
  const studentId = str(formData.get("studentId"));
  const missedDate = parseDate(formData.get("missedDate"));
  const plannedAt = parseDate(formData.get("plannedAt"));
  if (!lessonId || !studentId || !missedDate || !plannedAt) throw new Error("Заполните ученика, занятие и даты");

  const { session, lesson } = await assertCanMarkLesson(lessonId);
  await assertStudentInGroup(studentId, lesson.groupId);
  await prisma.makeup.upsert({
    where: { studentId_lessonId_missedDate: { studentId, lessonId, missedDate } },
    create: {
      studentId,
      lessonId,
      missedDate,
      plannedAt,
      note: str(formData.get("note")) || null,
      createdBy: session.user?.name ?? null,
    },
    update: { plannedAt, status: "PLANNED", note: str(formData.get("note")) || null },
  });
  const stu = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } });
  await logAudit("CREATE", "Отработка", `${stu?.name ?? ""} · ${lesson.group.name}`);
  revalidatePath("/makeups");
}

// Отработка проведена: ставим посещение на дату отработки — за него преподавателю платят.
export async function completeMakeup(id: string) {
  const m = await prisma.makeup.findUnique({ where: { id }, include: { student: { select: { name: true } } } });
  if (!m) throw new Error("Отработка не найдена");
  await assertCanMarkLesson(m.lessonId);

  const date = new Date(Date.UTC(m.plannedAt.getUTCFullYear(), m.plannedAt.getUTCMonth(), m.plannedAt.getUTCDate()));
  await prisma.$transaction([
    prisma.attendance.upsert({
      where: { lessonId_studentId_date: { lessonId: m.lessonId, studentId: m.studentId, date } },
      create: { lessonId: m.lessonId, studentId: m.studentId, date, present: true, excused: false },
      update: { present: true, excused: false },
    }),
    prisma.makeup.update({ where: { id }, data: { status: "DONE" } }),
  ]);

  await recalcAttendance([m.studentId]);
  await logAudit("UPDATE", "Отработка", `${m.student.name} · проведена`);
  revalidatePath("/makeups");
  revalidatePath("/payroll");
  revalidatePath("/students");
}

export async function cancelMakeup(id: string) {
  const m = await prisma.makeup.findUnique({ where: { id }, include: { student: { select: { name: true } } } });
  if (!m) return;
  await assertCanMarkLesson(m.lessonId);
  await prisma.makeup.update({ where: { id }, data: { status: "CANCELLED" } });
  await logAudit("UPDATE", "Отработка", `${m.student.name} · отменена`);
  revalidatePath("/makeups");
}

// ---------- Посещаемость ----------
// Отмена/восстановление занятия в конкретную дату.
// При отмене отметки посещаемости за этот день удаляются: занятия не было.
// fault: "TEACHER" — занятие сорвалось по вине преподавателя, тогда день остаётся
// в делителе зарплаты и за него не платят. "SCHOOL"/"OTHER"/пусто — день из делителя
// исключается, месячная доля преподавателя не страдает.
export async function setLessonCancelled(lessonId: string, dateStr: string, cancelled: boolean, reason: string, fault?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Требуется вход");
  const date = new Date(dateStr + "T00:00:00.000Z");

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { group: { include: { teacher: true, students: { select: { id: true } } } } },
  });
  if (!lesson) throw new Error("Занятие не найдено");
  // Отменять может админ/менеджер, преподаватель этой группы ИЛИ её куратор:
  // куратор ведёт журнал и раньше всех узнаёт, что занятия не было.
  const ownsLesson = lesson.group.teacher?.userId === session.user.id;
  const curates = await isCuratorOfGroup(session.user.id, lesson.groupId);
  if (!(await canEditData(session.user.role)) && !ownsLesson && !curates) throw new Error("Недостаточно прав");

  const faultValue = ["TEACHER", "SCHOOL", "OTHER"].includes(fault ?? "") ? (fault as string) : null;

  if (cancelled) {
    await prisma.attendance.deleteMany({ where: { lessonId, date } });
    await prisma.lessonSession.upsert({
      where: { lessonId_date: { lessonId, date } },
      create: { lessonId, date, topic: "", cancelled: true, cancelReason: str(reason) || null, cancelFault: faultValue },
      update: { cancelled: true, cancelReason: str(reason) || null, cancelFault: faultValue },
    });
  } else {
    await prisma.lessonSession.updateMany({ where: { lessonId, date }, data: { cancelled: false, cancelReason: null, cancelFault: null } });
  }

  await logAudit("UPDATE", "Занятие", `${lesson.group.name} · ${dateStr} · ${cancelled ? (faultValue === "TEACHER" ? "отменено по вине преподавателя" : "отменено") : "восстановлено"}`);

  const stC = await getSettings();
  if (cancelled && stC.notifyCancel) {
    const ids = lesson.group.students.map((s) => s.id);
    const cancelText = renderTemplate(stC.tplCancel || DEFAULT_TEMPLATES.cancel, {
      school: stC.schoolName,
      group: lesson.group.name,
      date: new Date(dateStr).toLocaleDateString("ru-RU"),
      reason: str(reason) || "",
    });
    await notifyParents(ids, cancelText);
    if (stC.notifyStudent) await notifyStudentsDirect(ids, cancelText);
  }
  revalidatePath(`/schedule/${lessonId}`);
  revalidatePath("/journal");
  revalidatePath("/payroll");
}

export async function saveAttendance(lessonId: string, dateStr: string, formData: FormData) {
  return asResult(() => doSaveAttendance(lessonId, dateStr, formData));
}

async function doSaveAttendance(lessonId: string, dateStr: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Требуется вход");
  const date = new Date(dateStr + "T00:00:00.000Z");

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { group: { include: { students: true, teacher: true } } },
  });
  if (!lesson) throw new Error("Занятие не найдено");

  // Отмечать может админ/менеджер, учитель этой группы ИЛИ её куратор
  const ownsLesson = lesson.group.teacher?.userId === session.user.id;
  const curates = await isCuratorOfGroup(session.user.id, lesson.groupId);
  if (!(await canEditData(session.user.role)) && !ownsLesson && !curates) throw new Error("Недостаточно прав");

  // Отменённый день выпал из делителя зарплаты — отметка на нём оплачивалась бы сверх него.
  // Форма в этот день скрыта, но её могли открыть до отмены в другой вкладке.
  const day = await prisma.lessonSession.findUnique({ where: { lessonId_date: { lessonId, date } }, select: { cancelled: true } });
  if (day?.cancelled) throw new UserError("Занятие в этот день отменено — обновите страницу");

  const students = lesson.group.students;

  // состояние: present | excused | unexcused. Пусто или неизвестно — ученика не трогаем:
  // раньше пустое значение записывалось как «прогул без причины».
  const VALID = new Set(["present", "excused", "unexcused"]);
  const marks = students
    .map((s) => ({ s, st: String(formData.get(`att_${s.id}`) ?? "") }))
    .filter(({ st }) => VALID.has(st));
  await prisma.$transaction(
    marks.map(({ s, st }) => {
      const present = st === "present";
      const excused = st === "excused";
      return prisma.attendance.upsert({
        where: { lessonId_studentId_date: { lessonId, studentId: s.id, date } },
        create: { lessonId, studentId: s.id, date, present, excused },
        update: { present, excused },
      });
    })
  );

  // Тема урока (журнал): пусто — убираем запись, иначе сохраняем/обновляем
  const topic = str(formData.get("topic"));
  if (topic) {
    await prisma.lessonSession.upsert({
      where: { lessonId_date: { lessonId, date } },
      create: { lessonId, date, topic },
      update: { topic },
    });
  } else {
    // Тему стёрли. Запись занятия можно убрать, только если на ней ничего не висит:
    // к ней могут быть привязаны материалы, а отмена занятия хранится тут же.
    const existing = await prisma.lessonSession.findUnique({
      where: { lessonId_date: { lessonId, date } },
      select: { id: true, cancelled: true, _count: { select: { materials: true } } },
    });
    if (existing) {
      if (existing.cancelled || existing._count.materials > 0) {
        await prisma.lessonSession.update({ where: { id: existing.id }, data: { topic: "" } });
      } else {
        await prisma.lessonSession.delete({ where: { id: existing.id } });
      }
    }
  }

  await recalcAttendance(students.map((s) => s.id));

  revalidatePath(`/schedule/${lessonId}`);
  revalidatePath("/schedule");
  revalidatePath("/students");
}
