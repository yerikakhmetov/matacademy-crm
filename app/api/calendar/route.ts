import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getStudentIdForUser } from "@/lib/teacher";
import { buildIcs, type IcsEvent } from "@/lib/ics";

export const dynamic = "force-dynamic";

// Расписание ученика в формате календаря: файл скачивается и импортируется
// в календарь телефона. Ссылку-подписку намеренно не делаем — это был бы
// ещё один постоянный секрет, доступный без входа.
export async function GET() {
  const session = await auth();
  const studentId = await getStudentIdForUser(session?.user?.id);
  if (!studentId) return new Response("Forbidden", { status: 403 });

  const [student, settings] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: { groups: { select: { name: true, lessons: { select: { id: true, dayOfWeek: true, startTime: true, room: true } } } } },
    }),
    getSettings(),
  ]);
  if (!student) return new Response("Forbidden", { status: 403 });

  const events: IcsEvent[] = student.groups.flatMap((g) =>
    g.lessons.map((l) => ({
      uid: `lesson-${l.id}@matacademy`,
      summary: g.name,
      location: l.room,
      dayOfWeek: l.dayOfWeek,
      startTime: l.startTime,
      durationMin: settings.lessonDurationMin,
    }))
  );

  const ics = buildIcs(events, { name: settings.schoolName, tzOffsetHours: settings.tzOffsetHours });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="schedule.ics"',
      "Cache-Control": "no-store",
    },
  });
}
