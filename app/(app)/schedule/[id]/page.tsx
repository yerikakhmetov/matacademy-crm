import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEdit } from "@/lib/roles";
import { DAYS } from "@/lib/format";
import { AttendanceForm } from "./AttendanceForm";
import { DeleteLessonButton } from "./DeleteLessonButton";

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
  const editor = canEdit(session?.user?.role);

  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: { group: { include: { teacher: true, students: { orderBy: { name: "asc" } } } } },
  });
  if (!lesson) notFound();

  // Отмечать посещаемость может админ/менеджер или учитель этой группы
  const ownsLesson = lesson.group.teacher?.userId === session?.user?.id;
  const canMark = editor || ownsLesson;

  const date = dateParam || recentDateForDay(lesson.dayOfWeek);
  const records = await prisma.attendance.findMany({
    where: { lessonId: id, date: new Date(date + "T00:00:00.000Z") },
  });
  const presentMap = new Map(records.map((r) => [r.studentId, r.present]));
  const students = lesson.group.students.map((s) => ({
    id: s.id,
    name: s.name,
    grade: s.grade,
    // если отметки ещё нет — по умолчанию присутствует
    present: presentMap.has(s.id) ? presentMap.get(s.id)! : true,
  }));

  const marked = records.length > 0;

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
        {editor && <DeleteLessonButton id={lesson.id} />}
      </div>

      <AttendanceForm
        lessonId={lesson.id}
        date={date}
        students={students}
        editor={canMark}
        marked={marked}
        weekday={lesson.dayOfWeek}
      />
    </>
  );
}
