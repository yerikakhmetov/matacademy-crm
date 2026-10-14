import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Icon } from "@/components/Icon";
import { DAYS } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { lessonStatus, minutesUntil, nextLessonAfterToday, pickFocus, type LessonStatus } from "@/lib/teacher-today";

const STATUS_CHIP: Record<LessonStatus, { cls: string; label: string }> = {
  marked: { cls: "c-ok", label: "Отмечено" },
  due: { cls: "c-warn", label: "Не отмечено" },
  upcoming: { cls: "c-mut", label: "Впереди" },
  cancelled: { cls: "c-mut", label: "Отменено" },
};

const DAY_NAMES_FULL = ["", "понедельник", "вторник", "среду", "четверг", "пятницу", "субботу", "воскресенье"];

// Главный экран преподавателя. Главное действие дня — отметить посещаемость занятия,
// поэтому первым идёт занятие, которое «горит», а статистика — внизу.
export async function TeacherDashboard({ userId, name }: { userId: string; name?: string | null }) {
  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  const teacherId = teacher?.id ?? "__none__";

  // «Сегодня» и время — по часовому поясу школы: сервер работает в UTC
  const tz = (await getSettings()).tzOffsetHours;
  const schoolNow = new Date(Date.now() + tz * 3_600_000);
  const nowHHMM = schoolNow.toISOString().slice(11, 16);
  const todayDow = schoolNow.getUTCDay() || 7; // 1 = Пн … 7 = Вс
  const todayDate = new Date(Date.UTC(schoolNow.getUTCFullYear(), schoolNow.getUTCMonth(), schoolNow.getUTCDate()));

  const [groups, students] = await Promise.all([
    prisma.group.findMany({
      where: { teacherId },
      include: {
        _count: { select: { students: true } },
        lessons: { where: { archivedAt: null }, orderBy: { startTime: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.student.findMany({ where: { groups: { some: { teacherId } } }, select: { attendance: true } }),
  ]);

  const allLessons = groups.flatMap((g) => g.lessons.map((l) => ({ ...l, group: g })));
  const todayRaw = allLessons.filter((l) => l.dayOfWeek === todayDow);
  const todayIds = todayRaw.map((l) => l.id);

  const [markedRows, cancelledRows] = todayIds.length
    ? await Promise.all([
        prisma.attendance.findMany({ where: { lessonId: { in: todayIds }, date: todayDate }, select: { lessonId: true }, distinct: ["lessonId"] }),
        prisma.lessonSession.findMany({ where: { lessonId: { in: todayIds }, date: todayDate, cancelled: true }, select: { lessonId: true } }),
      ])
    : [[], []];
  const markedIds = new Set(markedRows.map((r) => r.lessonId));
  const cancelledIds = new Set(cancelledRows.map((r) => r.lessonId));

  const today = todayRaw
    .map((l) => ({ ...l, marked: markedIds.has(l.id), cancelled: cancelledIds.has(l.id) }))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const focus = pickFocus(today, nowHHMM);
  const later = focus ? null : nextLessonAfterToday(allLessons, todayDow);

  const totalStudents = students.length;
  const attRated = students.filter((s) => s.attendance != null);
  const avgAtt = attRated.length ? Math.round(attRated.reduce((a, s) => a + (s.attendance ?? 0), 0) / attRated.length) : null;
  const weekLessons = allLessons.length;
  const leftToMark = today.filter((l) => lessonStatus(l, nowHHMM) === "due").length;

  const hour = schoolNow.getUTCHours();
  const greeting = hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";
  const dateStr = schoolNow.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const firstName = (name ?? "").split(" ")[0];

  const kpis = [
    { l: "Посещаемость", v: avgAtt == null ? "—" : `${avgAtt}%`, icon: "check", col: "var(--ok)", bg: "var(--ok-soft)" },
    { l: "Занятий в неделю", v: String(weekLessons), icon: "schedule", col: "var(--teal)", bg: "var(--teal-soft)" },
    { l: "Мои группы", v: String(groups.length), icon: "groups", col: "var(--accent)", bg: "var(--accent-soft)" },
    { l: "Мои ученики", v: String(totalStudents), icon: "students", col: "var(--violet)", bg: "var(--violet-soft)" },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{greeting}{firstName ? `, ${firstName}` : ""}</h1>
          <p>
            {dateStr}
            {leftToMark > 0 ? ` · не отмечено занятий: ${leftToMark}` : ""}
          </p>
        </div>
      </div>

      {/* Занятие, которое нужно отметить сейчас или следующее */}
      {focus ? (
        <div className="card focus-card" style={{ borderColor: focus.status === "due" ? "var(--warn)" : "var(--accent)" }}>
          <div className="focus-meta">
            {focus.status === "due"
              ? `Началось в ${focus.lesson.startTime} · посещаемость не отмечена`
              : (() => {
                  const m = minutesUntil(focus.lesson.startTime, nowHHMM);
                  return m <= 90 ? `Следующее занятие · ${focus.lesson.startTime} · через ${m} мин` : `Следующее занятие · сегодня в ${focus.lesson.startTime}`;
                })()}
          </div>
          <div className="focus-title">{focus.lesson.group.name}</div>
          <div className="mut" style={{ fontSize: 13 }}>
            {focus.lesson.room} · {focus.lesson.group._count.students} уч.
          </div>
          <Link className="btn focus-btn" href={`/schedule/${focus.lesson.id}`}>
            <Icon name="check" size={16} />
            Отметить посещаемость
          </Link>
        </div>
      ) : (
        <div className="card focus-card">
          <div className="focus-meta">{today.length > 0 ? "На сегодня всё отмечено" : "Сегодня занятий нет"}</div>
          {later ? (
            <>
              <div className="focus-title">{later.lesson.group.name}</div>
              <div className="mut" style={{ fontSize: 13 }}>
                Следующее занятие: {later.daysAhead === 1 ? "завтра" : `в ${DAY_NAMES_FULL[later.lesson.dayOfWeek]}`} в {later.lesson.startTime} · {later.lesson.room}
              </div>
            </>
          ) : (
            <div className="mut" style={{ fontSize: 13 }}>За вами пока не закреплены занятия.</div>
          )}
        </div>
      )}

      <div className="two-col" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-h">
            <h3>Сегодня</h3>
            <Link className="link" href="/schedule">
              Расписание →
            </Link>
          </div>
          <div style={{ padding: "6px 0" }}>
            {today.length === 0 && <div className="empty">Сегодня занятий нет</div>}
            {today.map((l) => {
              const st = STATUS_CHIP[lessonStatus(l, nowHHMM)];
              return (
                <Link href={`/schedule/${l.id}`} className="list-row" key={l.id} style={{ textDecoration: "none" }}>
                  <div style={{ width: 46, fontWeight: 700, fontSize: 13 }} className="num">
                    {l.startTime}
                  </div>
                  <div className="pay-ico" style={{ background: (l.group.color || "#3A5AE0") + "1f", color: l.group.color || "#3A5AE0" }}>
                    <Icon name="book" size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{l.group.name}</div>
                    <div className="mut" style={{ fontSize: 12 }}>
                      {l.room} · {l.group._count.students} уч.
                    </div>
                  </div>
                  <span className={`chip ${st.cls}`}>
                    <span className="d" />
                    {st.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>Мои группы</h3>
            <Link className="link" href="/groups">
              Все →
            </Link>
          </div>
          <div style={{ padding: "6px 0" }}>
            {groups.length === 0 && <div className="empty">За вами пока не закреплены группы</div>}
            {groups.map((g) => {
              const days = g.lessons
                .map((l) => l.dayOfWeek)
                .sort((a, b) => a - b)
                .map((d) => DAYS[d])
                .join(" · ");
              return (
                <div className="list-row" key={g.id}>
                  <div className="gtag" style={{ background: g.color, width: 34, height: 34, borderRadius: 9, fontSize: 13 }}>
                    {g.name[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{g.name}</div>
                    <div className="mut" style={{ fontSize: 12 }}>
                      {g.level} · {days || "нет занятий"}
                    </div>
                  </div>
                  <span className="chip c-mut">
                    <span className="d" />
                    {g._count.students} уч.
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid kpis" style={{ marginTop: 16 }}>
        {kpis.map((k) => (
          <div className="card kpi" key={k.l}>
            <div className="klabel">
              <span className="kico" style={{ background: k.bg, color: k.col }}>
                <Icon name={k.icon} size={16} />
              </span>
              {k.l}
            </div>
            <div className="kval num">{k.v}</div>
          </div>
        ))}
      </div>
    </>
  );
}
