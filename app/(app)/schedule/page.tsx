import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData } from "@/lib/access";
import { getTeacherIdForUser, isTeacher } from "@/lib/teacher";
import { DAYS } from "@/lib/format";
import { ModalButton } from "@/components/ModalButton";
import { LessonForm } from "./LessonForm";
import { createLesson } from "@/app/actions/data";
import { getSettings, parseList } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const session = await auth();
  const editor = await canEditData(session?.user?.role);
  const teacher = isTeacher(session?.user?.role);
  const myTeacherId = teacher ? await getTeacherIdForUser(session?.user?.id) : null;
  const groupWhere = teacher ? { teacherId: myTeacherId ?? "__none__" } : {};

  const [lessons, groups] = await Promise.all([
    prisma.lesson.findMany({ where: { group: groupWhere }, include: { group: { include: { teacher: true } } } }),
    prisma.group.findMany({ where: groupWhere, orderBy: { name: "asc" } }),
  ]);

  const times = Array.from(new Set(lessons.map((l) => l.startTime))).sort();
  const dayNums = [1, 2, 3, 4, 5, 6];
  const map = new Map<string, (typeof lessons)[number]>();
  for (const l of lessons) map.set(`${l.dayOfWeek}-${l.startTime}`, l);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Расписание</h1>
          <p>Недельная сетка · нажмите на занятие, чтобы отметить посещаемость</p>
        </div>
        {editor && (
          <ModalButton label="Добавить занятие" title="Новое занятие" action={createLesson}>
            <LessonForm groups={groups} rooms={parseList((await getSettings()).rooms)} />
          </ModalButton>
        )}
      </div>

      <div className="card sched">
        <div className="sgrid" style={{ gridTemplateColumns: `64px repeat(${dayNums.length}, minmax(150px, 1fr))` }}>
          <div className="sh" />
          {dayNums.map((d) => (
            <div className="sh" key={d}>
              {DAYS[d]}
            </div>
          ))}

          {times.map((time) => (
            <div key={time} style={{ display: "contents" }}>
              <div className="tcol">{time}</div>
              {dayNums.map((d) => {
                const lesson = map.get(`${d}-${time}`);
                return (
                  <div className="scell" key={d + time}>
                    {lesson && (
                      <Link
                        href={`/schedule/${lesson.id}`}
                        className="lesson"
                        style={{ background: (lesson.group.color || "#3A5AE0") + "14", borderColor: lesson.group.color || "#3A5AE0", display: "block" }}
                      >
                        <b>{lesson.group.name}</b>
                        <span className="lm">
                          {lesson.group.teacher?.name ?? "—"} · {lesson.room}
                        </span>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {times.length === 0 && (
            <div style={{ gridColumn: "1 / -1" }}>
              <div className="empty">Расписание пока не заполнено{editor ? " — добавьте первое занятие" : ""}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
