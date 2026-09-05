import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData } from "@/lib/access";
import { isTeacher } from "@/lib/teacher";
import { DAYS } from "@/lib/format";
import { getSettings, parseList } from "@/lib/settings";
import { ModalButton } from "@/components/ModalButton";
import { LessonForm } from "../LessonForm";
import { AttendanceForm } from "./AttendanceForm";
import { DeleteLessonButton } from "./DeleteLessonButton";
import { updateLesson } from "@/app/actions/data";

export const dynamic = "force-dynamic";

// Ближайшая (сегодня или ранее) дата нужного дня недели
function recentDateForDay(day: number): string {
  const today = new Date();
  const js = today.getDay() === 0 ? 7 : today.getDay(); // 1..7 Пн..Вс
  let diff = js - day;
  if (diff < 0) diff += 7;
  const d = new Date(today);
  d.setDate(today.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const { date: dateParam } = await searchParams;
  const session = await auth();
  const editor = await canEditData(session?.user?.role);

  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: { group: { include: { teacher: true, students: { orderBy: { name: "asc" } } } } },
  });
  if (!lesson) notFound();

  // Отмечать посещаемость может админ/менеджер или учитель этой группы
  const ownsLesson = lesson.group.teacher?.userId === session?.user?.id;
  // Преподаватель видит только свои занятия — иначе по прямой ссылке был бы виден чужой состав группы
  if (isTeacher(session?.user?.role) && !ownsLesson) redirect("/schedule");
  const canMark = editor || ownsLesson;

  const date = dateParam || recentDateForDay(lesson.dayOfWeek);
  const dateObj = new Date(date + "T00:00:00.000Z");
  const [records, session2] = await Promise.all([
    prisma.attendance.findMany({ where: { lessonId: id, date: dateObj } }),
    prisma.lessonSession.findUnique({ where: { lessonId_date: { lessonId: id, date: dateObj } } }),
  ]);
  const recMap = new Map(records.map((r) => [r.studentId, r]));
  const students = lesson.group.students.map((s) => {
    const r = recMap.get(s.id);
    // если отметки ещё нет — по умолчанию присутствует
    const state: "present" | "excused" | "unexcused" = !r ? "present" : r.present ? "present" : r.excused ? "excused" : "unexcused";
    return { id: s.id, name: s.name, grade: s.grade, state };
  });

  const marked = records.length > 0;

  const editData = editor
    ? { groups: await prisma.group.findMany({ orderBy: { name: "asc" } }), rooms: parseList((await getSettings()).rooms) }
    : null;

  return (
    <>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/schedule" className="close-x" style={{ textDecoration: "none" }}>
            ←
          </Link>
          <div className="gtag" style={{ background: lesson.group.color, width: 48, height: 48, borderRadius: 12, fontSize: 18 }}>
            {lesson.group.name[0]}
          </div>
          <div>
            <h1 style={{ fontSize: 22 }}>{lesson.group.name}</h1>
            <p>
              {DAYS[lesson.dayOfWeek]} · {lesson.startTime} · {lesson.room} · {lesson.group.teacher?.name ?? "—"}
            </p>
          </div>
        </div>
        {editor && editData && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <ModalButton label="Редактировать" title={`Занятие · ${lesson.group.name}`} icon="edit" buttonClass="btn ghost" action={updateLesson.bind(null, lesson.id)}>
              <LessonForm
                groups={editData.groups}
                rooms={editData.rooms}
                values={{ groupId: lesson.groupId, dayOfWeek: lesson.dayOfWeek, startTime: lesson.startTime, room: lesson.room }}
              />
            </ModalButton>
            <DeleteLessonButton id={lesson.id} />
          </div>
        )}
      </div>

      <AttendanceForm
        lessonId={lesson.id}
        date={date}
        students={students}
        editor={canMark}
        marked={marked}
        weekday={lesson.dayOfWeek}
        topic={session2?.topic ?? ""}
        cancelled={!!session2?.cancelled}
        cancelReason={session2?.cancelReason ?? ""}
      />
    </>
  );
}
