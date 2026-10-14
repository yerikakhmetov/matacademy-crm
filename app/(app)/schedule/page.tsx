import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData } from "@/lib/access";
import { getTeacherIdForUser, isTeacher } from "@/lib/teacher";
import { curatorGroupIds, groupWhereFor, isCurator } from "@/lib/curator";
import { DAYS } from "@/lib/format";
import { ModalButton } from "@/components/ModalButton";
import { LessonForm } from "./LessonForm";
import { createLesson } from "@/app/actions/lessons";
import { getSettings, parseList } from "@/lib/settings";
import { slotRunsOn } from "@/lib/payroll-calc";
import { addDays, isoDay, parseWeek, schoolClock } from "@/lib/school-time";

export const dynamic = "force-dynamic";

const dayLabel = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" });

type Status = "marked" | "due" | "cancelled" | null;
const STATUS: Record<Exclude<Status, null>, { cls: string; label: string }> = {
  marked: { cls: "c-ok", label: "Отмечено" },
  due: { cls: "c-warn", label: "Не отмечено" },
  cancelled: { cls: "c-mut", label: "Отменено" },
};

// Расписание конкретной недели: даты, сегодня, отметки и отмены.
// Раньше это была сетка без дат — «вторник» без понимания, какой именно,
// и не видно, где посещаемость ещё не отмечена.
export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams;
  const session = await auth();
  const editor = await canEditData(session?.user?.role);
  const teacher = isTeacher(session?.user?.role);
  const myTeacherId = teacher ? await getTeacherIdForUser(session?.user?.id) : null;
  const curator = isCurator(session?.user?.role);
  // куратор видит расписание только своих групп
  const curGroupIds = curator ? await curatorGroupIds(session?.user?.id) : [];
  const groupWhere = groupWhereFor({ teacher, teacherId: myTeacherId, curator, groupIds: curGroupIds });

  const settings = await getSettings();
  const clock = schoolClock(settings.tzOffsetHours);
  const todayIso = clock.toISOString().slice(0, 10);
  const nowHHMM = clock.toISOString().slice(11, 16);
  const today = new Date(todayIso + "T00:00:00.000Z");
  const monday = parseWeek(week, today);
  const nextMonday = addDays(monday, 7);
  const days = [1, 2, 3, 4, 5, 6].map((dow) => ({ dow, date: addDays(monday, dow - 1) }));

  const [lessons, groups] = await Promise.all([
    // архивные слоты тоже: в прошлых неделях они ещё шли
    prisma.lesson.findMany({
      where: { group: groupWhere, OR: [{ archivedAt: null }, { archivedAt: { gt: monday } }] },
      include: { group: { include: { teacher: true } } },
      orderBy: { startTime: "asc" },
    }),
    prisma.group.findMany({ where: groupWhere, orderBy: { name: "asc" } }),
  ]);
  const ids = lessons.map((l) => l.id);
  const [markedRows, cancelledRows] = ids.length
    ? await Promise.all([
        prisma.attendance.findMany({
          where: { lessonId: { in: ids }, date: { gte: monday, lt: nextMonday } },
          select: { lessonId: true, date: true },
          distinct: ["lessonId", "date"],
        }),
        prisma.lessonSession.findMany({
          where: { lessonId: { in: ids }, date: { gte: monday, lt: nextMonday }, cancelled: true },
          select: { lessonId: true, date: true },
        }),
      ])
    : [[], []];
  const key = (lessonId: string, d: Date) => `${lessonId}|${isoDay(d)}`;
  const marked = new Set(markedRows.map((r) => key(r.lessonId, r.date)));
  const cancelled = new Set(cancelledRows.map((r) => key(r.lessonId, r.date)));

  // Занятия недели по дням; в одно время может идти несколько групп — раньше показывалась одна
  type L = (typeof lessons)[number];
  type Occ = { lesson: L; iso: string; status: Status };
  const byDay = new Map<number, Occ[]>();
  for (const { dow, date } of days) {
    const iso = isoDay(date);
    const list: Occ[] = [];
    for (const l of lessons) {
      if (l.dayOfWeek !== dow || !slotRunsOn(date, l, l.group.startDate)) continue;
      const k = key(l.id, date);
      const started = iso < todayIso || (iso === todayIso && l.startTime <= nowHHMM);
      const status: Status = cancelled.has(k) ? "cancelled" : marked.has(k) ? "marked" : started ? "due" : null;
      list.push({ lesson: l, iso, status });
    }
    byDay.set(dow, list);
  }
  const all = [...byDay.values()].flat();
  const times = Array.from(new Set(all.map((o) => o.lesson.startTime))).sort();
  const dueCount = all.filter((o) => o.status === "due").length;
  const hasSchedule = lessons.some((l) => !l.archivedAt);

  const weekHref = (d: Date) => `/schedule?week=${isoDay(d)}`;
  const thisWeek = isoDay(monday) === isoDay(parseWeek(undefined, today));
  const range = `${dayLabel(monday)} – ${dayLabel(addDays(monday, 5))}`;

  const card = (o: Occ) => {
    const l = o.lesson;
    const color = l.group.color || "#3A5AE0";
    return (
      <Link
        key={l.id}
        href={`/schedule/${l.id}?date=${o.iso}`}
        className={`lesson${o.status === "cancelled" ? " is-cancelled" : ""}`}
        style={{ background: color + "14", borderColor: color, display: "block" }}
      >
        <b>{l.group.name}</b>
        <span className="lm">
          {l.startTime} · {l.group.teacher?.name ?? "—"} · {l.room}
        </span>
        {o.status && (
          <span className={`chip ${STATUS[o.status].cls} lesson-st`}>
            <span className="d" />
            {STATUS[o.status].label}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Расписание</h1>
          <p>
            {range}
            {dueCount > 0 ? ` · не отмечено занятий: ${dueCount}` : ""}
          </p>
        </div>
        {editor && (
          <ModalButton label="Добавить занятие" title="Новое занятие" action={createLesson}>
            <LessonForm groups={groups} rooms={parseList(settings.rooms)} />
          </ModalButton>
        )}
      </div>

      <nav className="week-nav" aria-label="Неделя">
        <Link className="btn ghost" href={weekHref(addDays(monday, -7))}>← Пред.</Link>
        {!thisWeek && <Link className="btn ghost" href="/schedule">Текущая неделя</Link>}
        <Link className="btn ghost" href={weekHref(nextMonday)}>След. →</Link>
      </nav>

      <div className="card sched">
        <div className="sgrid" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(150px, 1fr))` }}>
          <div className="sh" />
          {days.map(({ dow, date }) => (
            <div className={`sh${isoDay(date) === todayIso ? " today" : ""}`} key={dow}>
              {DAYS[dow]}
              <small>{isoDay(date) === todayIso ? "сегодня" : dayLabel(date)}</small>
            </div>
          ))}

          {times.map((time) => (
            <div key={time} style={{ display: "contents" }}>
              <div className="tcol">{time}</div>
              {days.map(({ dow, date }) => (
                <div className={`scell${isoDay(date) === todayIso ? " today" : ""}`} key={dow + time}>
                  {(byDay.get(dow) ?? []).filter((o) => o.lesson.startTime === time).map(card)}
                </div>
              ))}
            </div>
          ))}

          {times.length === 0 && (
            <div style={{ gridColumn: "1 / -1" }}>
              <div className="empty">
                {hasSchedule ? "На этой неделе занятий нет" : `Расписание пока не заполнено${editor ? " — добавьте первое занятие" : ""}`}
              </div>
            </div>
          )}
        </div>

        {/* На телефоне сетка в 900px не помещается — показываем список по дням */}
        <div className="sched-agenda">
          {days.map(({ dow, date }) => {
            const list = byDay.get(dow) ?? [];
            const isToday = isoDay(date) === todayIso;
            return (
              <section key={dow} className={isToday ? "today" : undefined}>
                <h3>
                  {DAYS[dow]}, {dayLabel(date)}
                  {isToday && <span className="chip c-ok"><span className="d" />сегодня</span>}
                </h3>
                {list.length === 0 ? <div className="mut agenda-empty">Нет занятий</div> : list.map(card)}
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
