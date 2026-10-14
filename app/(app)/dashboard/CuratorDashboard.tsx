import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Icon } from "@/components/Icon";
import { ReminderActions } from "@/components/ReminderActions";
import { money } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { gatherCuratorPayroll } from "@/lib/payroll";
import { lessonStatus, type LessonStatus } from "@/lib/teacher-today";
import { frequentAbsentees } from "@/lib/curator-home";
import { cachedPackageAlerts, packageItemText } from "@/lib/reminders";

const STATUS_CHIP: Record<LessonStatus, { cls: string; label: string }> = {
  marked: { cls: "c-ok", label: "Отмечено" },
  due: { cls: "c-warn", label: "Не отмечено" },
  upcoming: { cls: "c-mut", label: "Впереди" },
  cancelled: { cls: "c-mut", label: "Отменено" },
};

const WINDOW_DAYS = 14;

// Главный экран куратора: занятия его групп сегодня, кто часто пропускает, группы и зарплата.
// Раньше куратор сразу попадал в недельное расписание, а пропуски приходилось искать по журналам.
export async function CuratorDashboard({ userId, name }: { userId: string; name?: string | null }) {
  const settings = await getSettings();
  const tz = settings.tzOffsetHours;
  const schoolNow = new Date(Date.now() + tz * 3_600_000);
  const nowHHMM = schoolNow.toISOString().slice(11, 16);
  const todayDow = schoolNow.getUTCDay() || 7;
  const todayDate = new Date(Date.UTC(schoolNow.getUTCFullYear(), schoolNow.getUTCMonth(), schoolNow.getUTCDate()));
  const since = new Date(todayDate.getTime() - WINDOW_DAYS * 86_400_000);

  const groups = await prisma.group.findMany({
    where: { curatorId: userId },
    include: {
      subject: { select: { name: true } },
      teacher: { select: { name: true } },
      students: { select: { id: true, name: true, parentPhone: true, attendance: true } },
      lessons: { where: { archivedAt: null }, orderBy: { startTime: "asc" } },
    },
    orderBy: { name: "asc" },
  });

  const lessonIds = groups.flatMap((g) => g.lessons.map((l) => l.id));
  const todayLessons = groups
    .flatMap((g) => g.lessons.filter((l) => l.dayOfWeek === todayDow).map((l) => ({ ...l, group: g })))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const todayIds = todayLessons.map((l) => l.id);

  const [markedRows, cancelledRows, recentMarks, payroll] = await Promise.all([
    todayIds.length
      ? prisma.attendance.findMany({ where: { lessonId: { in: todayIds }, date: todayDate }, select: { lessonId: true }, distinct: ["lessonId"] })
      : Promise.resolve([]),
    todayIds.length
      ? prisma.lessonSession.findMany({ where: { lessonId: { in: todayIds }, date: todayDate, cancelled: true }, select: { lessonId: true } })
      : Promise.resolve([]),
    lessonIds.length
      ? prisma.attendance.findMany({
          where: { lessonId: { in: lessonIds }, date: { gte: since, lte: todayDate } },
          select: { studentId: true, present: true, excused: true },
        })
      : Promise.resolve([]),
    gatherCuratorPayroll(schoolNow.getUTCFullYear(), schoolNow.getUTCMonth(), settings.curatorRate),
  ]);
  const marked = new Set(markedRows.map((r) => r.lessonId));
  const cancelled = new Set(cancelledRows.map((r) => r.lessonId));
  const today = todayLessons.map((l) => ({ ...l, marked: marked.has(l.id), cancelled: cancelled.has(l.id) }));

  const studentById = new Map(groups.flatMap((g) => g.students.map((s) => [s.id, { ...s, groupName: g.name }] as const)));
  const absentees = frequentAbsentees(recentMarks).filter((a) => studentById.has(a.studentId));

  // Заканчиваются оплаченные занятия у учеников его групп (по предметам этих групп):
  // куратор на связи с родителями — ему и напоминать. Суммы не показываем, только занятия.
  const mySubjects = new Map<string, Set<string>>(); // studentId -> предметы его групп у куратора
  for (const g of groups) {
    if (!g.subjectId) continue;
    for (const s of g.students) {
      const set = mySubjects.get(s.id) ?? new Set<string>();
      set.add(g.subjectId);
      mySubjects.set(s.id, set);
    }
  }
  const ending = (await cachedPackageAlerts())
    .map((r) => ({ ...r, items: r.items.filter((it) => mySubjects.get(r.studentId)?.has(it.subjectId)) }))
    .filter((r) => r.items.length > 0);

  const myRow = payroll.get(userId);
  const allStudents = new Set(groups.flatMap((g) => g.students.map((s) => s.id)));
  const leftToMark = today.filter((l) => lessonStatus(l, nowHHMM) === "due").length;

  const hour = schoolNow.getUTCHours();
  const greeting = hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";
  const dateStr = schoolNow.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const firstName = (name ?? "").split(" ")[0];

  const kpis = [
    { l: "Мои группы", v: String(groups.length), icon: "groups", col: "var(--accent)", bg: "var(--accent-soft)" },
    { l: "Ученики", v: String(allStudents.size), icon: "students", col: "var(--violet)", bg: "var(--violet-soft)" },
    { l: `Пропускают (${WINDOW_DAYS} дн.)`, v: String(absentees.length), icon: "alert", col: "var(--bad)", bg: "var(--bad-soft)" },
    { l: "Моя зарплата", v: money(myRow?.salary ?? 0), icon: "money", col: "var(--ok)", bg: "var(--ok-soft)" },
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

      <div className="grid kpis">
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

      <div className="two-col" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-h">
              <h3>Сегодня в моих группах</h3>
              <Link className="link" href="/schedule">Расписание →</Link>
            </div>
            <div style={{ padding: "6px 0" }}>
              {today.length === 0 && <div className="empty">Сегодня занятий нет</div>}
              {today.map((l) => {
                const st = STATUS_CHIP[lessonStatus(l, nowHHMM)];
                return (
                  <Link href={`/schedule/${l.id}`} className="list-row" key={l.id} style={{ textDecoration: "none" }}>
                    <div style={{ width: 46, fontWeight: 700, fontSize: 13 }} className="num">{l.startTime}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{l.group.name}</div>
                      <div className="mut" style={{ fontSize: 12 }}>
                        {l.room}{l.group.teacher ? ` · ${l.group.teacher.name}` : ""}
                      </div>
                    </div>
                    <span className={`chip ${st.cls}`}><span className="d" />{st.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h3>Часто пропускают</h3>
              <span className="chip c-mut"><span className="d" />за {WINDOW_DAYS} дней</span>
            </div>
            <div style={{ padding: "6px 0" }}>
              {absentees.length === 0 && <div className="empty">За две недели никто не пропустил больше одного занятия</div>}
              {absentees.map((a) => {
                const s = studentById.get(a.studentId)!;
                const msg = `Здравствуйте! ${s.name} пропустил(а) ${a.missed} занятий за последние две недели (группа «${s.groupName}»). Подскажите, пожалуйста, всё ли в порядке?`;
                return (
                  <div className="list-row attn-row" key={a.studentId}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/students/${a.studentId}?tab=attendance`} style={{ fontWeight: 600, color: "inherit" }}>{s.name}</Link>
                      <div className="mut" style={{ fontSize: 12 }}>
                        {s.groupName} · пропусков: {a.missed}
                        {a.unexcused > 0 ? `, без причины: ${a.unexcused}` : ""}
                      </div>
                    </div>
                    <ReminderActions phone={s.parentPhone} message={msg} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {ending.length > 0 && (
            <div className="card">
              <div className="card-h">
                <h3>Заканчиваются занятия</h3>
                <span className="chip c-warn"><span className="d" />{ending.length}</span>
              </div>
              <div style={{ padding: "6px 0" }}>
                {ending.map((r) => {
                  const lessons = r.items.map(packageItemText).join("; ");
                  const msg = `Здравствуйте! У ${r.name} заканчиваются оплаченные занятия (${lessons}). Чтобы занятия шли без перерыва, пожалуйста, оплатите следующий месяц обучения. Спасибо!`;
                  return (
                    <div className="list-row attn-row" key={r.studentId}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link href={`/students/${r.studentId}`} style={{ fontWeight: 600, color: "inherit" }}>{r.name}</Link>
                        <div className="mut" style={{ fontSize: 12 }}>
                          {lessons}
                          {r.items.some((it) => it.notified) ? " · ✓ напомнили в Telegram" : ""}
                        </div>
                      </div>
                      <ReminderActions phone={r.parentPhone} message={msg} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-h">
              <h3>Мои группы</h3>
              <Link className="link" href="/groups">Все →</Link>
            </div>
            <div style={{ padding: "6px 0" }}>
              {groups.length === 0 && <div className="empty">За вами пока не закреплены группы</div>}
              {groups.map((g) => {
                const rated = g.students.filter((s) => s.attendance != null);
                const avg = rated.length ? Math.round(rated.reduce((a, s) => a + (s.attendance ?? 0), 0) / rated.length) : null;
                return (
                  <Link href={`/journal?group=${g.id}`} className="list-row" key={g.id} style={{ textDecoration: "none" }}>
                    <div className="gtag" style={{ background: g.color, width: 34, height: 34, borderRadius: 9, fontSize: 13 }}>{g.name[0]}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{g.name}</div>
                      <div className="mut" style={{ fontSize: 12 }}>
                        {[g.subject?.name, g.teacher?.name].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    <span className="chip c-mut"><span className="d" />{g.students.length} уч.{avg != null ? ` · ${avg}%` : ""}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div className="mut" style={{ fontSize: 12.5, fontWeight: 600 }}>Зарплата за этот месяц</div>
            <div className="kval num" style={{ fontSize: 26, margin: "6px 0 2px" }}>{money(myRow?.salary ?? 0)}</div>
            <div className="mut" style={{ fontSize: 12.5 }}>
              {myRow ? `${myRow.students} учеников оплатили · ${myRow.byGroup.length} групп` : "Пока нет оплаченных счетов"}
            </div>
            <Link className="link" href="/my-salary" style={{ display: "inline-block", marginTop: 8 }}>Подробнее →</Link>
          </div>
        </div>
      </div>
    </>
  );
}
