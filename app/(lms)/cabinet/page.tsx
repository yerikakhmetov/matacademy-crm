import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getStudentIdForUser } from "@/lib/teacher";
import { formatDate, scoreColor, gradeChipClass } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { BarChart } from "@/components/BarChart";
import { CabinetHomework } from "./CabinetHomework";
import { isTestOpen, testAvailableAt } from "@/lib/tests";
import { getSettings } from "@/lib/settings";
import { getLocale } from "@/lib/locale";
import { dayShort, gradeTypeLabel, t } from "@/lib/i18n";
import { GradeMonthSummary } from "@/components/GradeMonthSummary";
import { lessonsLeftAll } from "@/lib/payroll";
import { leftKey } from "@/lib/packages";
import { ZachetList } from "@/components/ZachetList";
import { GroupRatingList, loadGroupRating } from "@/components/GroupRating";
import { PhotoCropper } from "@/components/PhotoCropper";

export const dynamic = "force-dynamic";

// Кабинет разбит на вкладки: одна длинная страница на телефоне растягивалась на 8–10 экранов.
const TABS = ["home", "tests", "grades", "rating", "tasks", "schedule"] as const;
type Tab = (typeof TABS)[number];
const TAB_ICON: Record<Tab, string> = { home: "dashboard", tests: "check", grades: "chart", rating: "trophy", tasks: "book", schedule: "schedule" };

export default async function CabinetHome({ searchParams }: { searchParams: Promise<{ tab?: string; g?: string }> }) {
  const { tab: tabParam, g: groupParam } = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as Tab) : "home";
  const session = await auth();
  const locale = await getLocale();
  const studentId = await getStudentIdForUser(session?.user?.id);
  if (!studentId) {
    return <div className="card"><div className="empty">{t(locale, "cabinet.profileNotFound")}</div></div>;
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      groups: { include: { teacher: true, lessons: { where: { archivedAt: null } }, subject: { select: { id: true, name: true } } } },
      grades: {
        orderBy: { date: "desc" },
        take: 10,
        include: { group: { select: { name: true, subject: { select: { name: true } } } } },
      },
    },
  });
  if (!student) redirect("/login");

  const groupIds = student.groups.map((g) => g.id);

  // Зачёты групп ученика с его отметкой: 15 последних (предстоящие и прошедшие)
  const zachetRows = groupIds.length
    ? (
        await prisma.zachet.findMany({
          where: { groupId: { in: groupIds } },
          orderBy: { scheduledAt: "desc" },
          take: 15,
          include: { group: { select: { name: true } }, results: { where: { studentId: studentId }, select: { passed: true } } },
        })
      ).map((z) => ({ id: z.id, topic: z.topic, scheduledAt: z.scheduledAt, groupName: z.group.name, result: z.results[0] ?? null }))
    : [];
  const homeworks = groupIds.length
    ? await prisma.homework.findMany({
        where: { groupId: { in: groupIds } },
        orderBy: { createdAt: "desc" },
        // Сданное ДЗ уходит вниз списка: при лимите 6 старое задание пропадало
        // с экрана вместе с кнопкой «Қайта тапсыру».
        take: 14,
        include: { completions: { where: { studentId } }, group: { select: { name: true } } },
      })
    : [];
  const materials = await prisma.material.findMany({
    where: { OR: [{ groupId: null }, ...(groupIds.length ? [{ groupId: { in: groupIds } }] : [])] },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const tz = (await getSettings()).tzOffsetHours;
  const testsRaw = groupIds.length
    ? await prisma.test.findMany({
        // Тест бірнеше топқа берілуі мүмкін — оқушының тобы солардың біріне кірсе көрінеді
        where: { groupLinks: { some: { groupId: { in: groupIds } } }, questions: { some: {} } },
        orderBy: { date: "desc" },
        // 12 было мало: у группы за четверть набирается больше тестов, и старые пропадали из кабинета
        take: 40,
        include: {
          _count: { select: { questions: true } },
          attempts: { where: { studentId }, select: { score: true, correctCount: true, total: true, finished: true } },
          subject: { select: { name: true, color: true } },
          groupLinks: { select: { groupId: true, date: true } },
        },
      })
    : [];
  const lessonsByGroup = new Map(student.groups.map((g) => [g.id, g.lessons.map((l) => ({ dayOfWeek: l.dayOfWeek, startTime: l.startTime }))]));
  const tests = testsRaw.map((row) => {
    // Қолжетімділік оқушының ӨЗ тобының кестесімен есептеледі
    const link = row.groupLinks.find((l) => lessonsByGroup.has(l.groupId));
    const lessons = lessonsByGroup.get(link?.groupId ?? row.groupId ?? "") ?? [];
    // Топтың өз күні болса, сол бойынша; болмаса тесттің ортақ күні
    const date = link?.date ?? row.date;
    // Начатая, но не сданная попытка — это не результат: «0/100» пугало бы ученика,
    // а тест пропадал из счётчика непройденных. Показываем «продолжить».
    const raw = row.attempts[0] ?? null;
    const attempt = raw?.finished ? raw : null;
    const inProgress = raw != null && !raw.finished;
    return {
      id: row.id,
      title: row.title,
      date,
      maxScore: row.maxScore,
      questions: row._count.questions,
      subjectName: row.subject?.name ?? null,
      subjectColor: row.subject?.color ?? "#3A5AE0",
      attempt,
      inProgress,
      open: isTestOpen(date, lessons, new Date(), tz, row.availableFrom),
      opensAt: testAvailableAt(date, lessons, tz, row.availableFrom),
    };
  });

  const attendance = await prisma.attendance.findMany({
    where: { studentId },
    orderBy: { date: "desc" },
    take: 20,
    include: { lesson: { include: { group: { select: { name: true, color: true } } } } },
  });

  const makeups = await prisma.makeup.findMany({
    where: { studentId, status: "PLANNED" },
    orderBy: { plannedAt: "asc" },
    include: { lesson: { include: { group: { select: { name: true, color: true } } } } },
  });

  const topics = groupIds.length
    ? await prisma.lessonSession.findMany({
        where: { lesson: { groupId: { in: groupIds } }, cancelled: false, topic: { not: "" } },
        orderBy: { date: "desc" },
        take: 8,
        include: { lesson: { include: { group: { select: { name: true, color: true } } } } },
      })
    : [];

  const hwItems = homeworks
    .map((hw) => ({
      id: hw.id,
      title: hw.title,
      description: hw.description,
      groupName: hw.group.name,
      dueLabel: hw.dueDate ? formatDate(hw.dueDate) : null,
      dueTs: hw.dueDate ? new Date(hw.dueDate).getTime() : null,
      done: hw.completions[0]?.done ?? false,
      fileUrl: hw.completions[0]?.fileUrl ?? null,
      fileName: hw.completions[0]?.fileName ?? null,
    }))
    // Сначала невыполненные и с ближайшим сроком: раньше список шёл по дате
    // создания, и задание «на завтра» могло оказаться внизу.
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return (a.dueTs ?? Infinity) - (b.dueTs ?? Infinity);
    });

  const avg = student.grades.length
    ? Math.round(student.grades.reduce((a, g) => a + (g.score / g.maxScore) * 100, 0) / student.grades.length)
    : null;
  const lessons = student.groups
    .flatMap((g) =>
      g.lessons.map((l) => ({
        ...l,
        groupName: g.name,
        color: g.color,
        teacherName: g.teacher?.name ?? null,
        startsOn: g.startDate, // группа ещё не начала — занятия впереди, а не сегодня
      }))
    )
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));

  const shortDate = (d: Date) => `${d.getUTCDate()}.${d.getUTCMonth() + 1}`;
  const progress = [...student.grades]
    .reverse()
    .map((g) => ({ label: shortDate(new Date(g.date)), value: Math.round((g.score / g.maxScore) * 100) }));

  // Сколько оплаченных занятий осталось по предметам (месяц обучения — пакет занятий).
  // Считаем только для главной вкладки: там это и показывается.
  const subjects = [...new Map(student.groups.filter((g) => g.subject).map((g) => [g.subject!.id, g.subject!])).values()];
  const leftMap = tab === "home" && subjects.length > 0 ? await lessonsLeftAll([studentId]) : new Map();
  const paidLessons = subjects
    .map((s) => ({ ...s, ...(leftMap.get(leftKey(studentId, s.id)) ?? { left: 0, total: 0, unpaid: 0 }) }))
    .filter((p) => p.total > 0 || p.unpaid > 0);

  // «Сегодня» — по часовому поясу школы: сервер работает в UTC, и в Алматы с 00 до 05
  // кабинет показывал вчерашние занятия. Даты сроков хранятся UTC-полуночью — сравниваем так же.
  const schoolNow = new Date(Date.now() + tz * 3_600_000);
  const startOfToday = Date.UTC(schoolNow.getUTCFullYear(), schoolNow.getUTCMonth(), schoolNow.getUTCDate());
  const endOfTomorrow = startOfToday + 2 * 24 * 3600 * 1000;
  const todayDow = schoolNow.getUTCDay() || 7; // 1..6 = Пн..Сб (как в расписании)
  const hour = schoolNow.getUTCHours();
  const greeting = hour < 12 ? t(locale, "cabinet.morning") : hour < 18 ? t(locale, "cabinet.day") : t(locale, "cabinet.evening");

  // Блок «Сегодня»: то, ради чего кабинет чаще всего и открывают
  const started = (l: { startsOn: Date | null }) => l.startsOn == null || l.startsOn.getTime() <= startOfToday;
  const todayLessons = lessons.filter((l) => l.dayOfWeek === todayDow && started(l));
  const dueSoon = hwItems.filter((h) => !h.done && h.dueTs != null && h.dueTs < endOfTomorrow);
  const openTests = tests.filter((x) => x.open && !x.attempt);
  const dueLabelFor = (ts: number) =>
    ts < startOfToday
      ? t(locale, "today.overdue")
      : ts < startOfToday + 24 * 3600 * 1000
        ? t(locale, "today.dueToday")
        : t(locale, "today.dueTomorrow");

  // Рейтинг: на вкладке — выбранная группа, на главной — первая группа ученика (место и очки)
  const ratingGroup =
    tab === "rating" || tab === "home"
      ? (student.groups.find((g) => g.id === groupParam) ?? student.groups[0] ?? null)
      : null;
  const rating = ratingGroup ? await loadGroupRating(ratingGroup.id, tz) : null;
  const myRating = rating?.rows.find((r) => r.studentId === studentId);

  const badges: Partial<Record<Tab, number>> = { tests: openTests.length, tasks: dueSoon.length };
  const tabLabel: Record<Tab, string> = {
    home: t(locale, "tabs.home"),
    tests: t(locale, "tabs.tests"),
    grades: t(locale, "tabs.grades"),
    rating: t(locale, "tabs.rating"),
    tasks: t(locale, "tabs.tasks"),
    schedule: t(locale, "tabs.schedule"),
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <nav className="cab-tabs" aria-label={t(locale, "tabs.label")}>
        {TABS.map((k) => (
          <Link
            key={k}
            href={k === "home" ? "/cabinet" : `/cabinet?tab=${k}`}
            className={`cab-tab${k === tab ? " on" : ""}`}
            aria-current={k === tab ? "page" : undefined}
          >
            <span className="cab-tab-ico" aria-hidden="true">
              <Icon name={TAB_ICON[k]} size={18} />
              {badges[k] ? <span className="cab-badge">{badges[k]}</span> : null}
            </span>
            <span>{tabLabel[k]}</span>
          </Link>
        ))}
      </nav>
{tab === "home" && (
        <>
      <div className="card" style={{ padding: 20, display: "flex", alignItems: "center", gap: 14 }}>
        <PhotoCropper
          studentId={student.id}
          name={student.name}
          photoUrl={student.photoUrl}
          labels={{
            change: t(locale, "photo.change"),
            hint: t(locale, "photo.hint"),
            zoom: t(locale, "photo.zoom"),
            save: t(locale, "photo.save"),
            cancel: t(locale, "photo.cancel"),
            error: t(locale, "photo.error"),
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 20 }}>{greeting}, {student.name.split(" ")[0]}!</h1>
          <p className="mut" style={{ fontSize: 13, margin: "2px 0 0" }}>
            {student.groups.map((g) => g.name).join(", ") || t(locale, "common.noGroup")}
          </p>
        </div>
      </div>

      {/* Профориентация: личная ссылка на тест MentorHub (ставит админ) */}
      {student.careerTestUrl && (
        <div className="card" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{t(locale, "career.title")}</div>
            <div className="mut" style={{ fontSize: 13, marginTop: 2 }}>{t(locale, "career.text")}</div>
          </div>
          <a className="btn" href={student.careerTestUrl} target="_blank" rel="noreferrer">
            {t(locale, "career.start")}
          </a>
        </div>
      )}

      {ratingGroup && myRating && rating && rating.rows.length > 1 && (
        <Link href="/cabinet?tab=rating" className="card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: "inherit" }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center", flex: "none" }}>
            <Icon name="trophy" size={20} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mut" style={{ fontSize: 12.5 }}>{t(locale, "rating.homeCard", { group: ratingGroup.name })}</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {t(locale, "rating.place", { n: myRating.place })} <span className="mut" style={{ fontWeight: 500 }}>/ {rating.rows.length} · {t(locale, "rating.points", { n: myRating.points })}</span>
            </div>
          </div>
          <span className="mut">→</span>
        </Link>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div className="card-h"><h3>{t(locale, "today.title")}</h3></div>
        <div style={{ padding: "6px 0" }}>
          {todayLessons.length === 0 && dueSoon.length === 0 && openTests.length === 0 && (
            <div className="empty">{t(locale, "today.noLessons")}</div>
          )}
          {todayLessons.map((l) => (
            <div className="list-row" key={`t-${l.id}`}>
              <div className="num" style={{ width: 54, fontWeight: 700 }}>{l.startTime}</div>
              <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: l.color, flex: "none" }} />
                <span style={{ fontWeight: 600 }}>{l.groupName}</span>
                <span className="mut" style={{ fontSize: 12 }}>{l.room}</span>
              </div>
            </div>
          ))}
          {dueSoon.map((h) => (
            <div className="list-row" key={`d-${h.id}`}>
              <span className="chip c-warn" style={{ flex: "none" }}><span className="d" />{t(locale, "today.dueSoon")}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{h.title}</div>
                <div className="mut" style={{ fontSize: 12 }}>{h.groupName} · {dueLabelFor(h.dueTs as number)}</div>
              </div>
            </div>
          ))}
          {openTests.map((x) => (
            <Link className="list-row" key={`x-${x.id}`} href={`/cabinet/test/${x.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <span className="chip c-ok" style={{ flex: "none" }}><span className="d" />{t(locale, "today.testsOpen")}</span>
              <div style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{x.title}</div>
              <span className="mut" style={{ fontSize: 12 }}>→</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid kpis" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
        <div className="card kpi">
          <div className="klabel"><span className="kico" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}><Icon name="check" size={16} /></span>{t(locale, "cabinet.attendance")}</div>
          <div className="kval num" style={{ color: student.attendance == null ? "var(--ink-3)" : scoreColor(student.attendance) }}>{student.attendance == null ? "—" : `${student.attendance}%`}</div>
        </div>
        <div className="card kpi">
          <div className="klabel"><span className="kico" style={{ background: "var(--violet-soft)", color: "var(--violet)" }}><Icon name="chart" size={16} /></span>{t(locale, "cabinet.avgScore")}</div>
          <div className="kval num" style={{ color: avg != null ? scoreColor(avg) : "var(--ink-3)" }}>{avg != null ? `${avg}%` : "—"}</div>
        </div>

      {paidLessons.length > 0 && (
        <div className="card" style={{ marginTop: 16, gridColumn: "1 / -1" }}>
          <div className="card-h"><h3>{t(locale, "cabinet.paidLessons")}</h3></div>
          <div style={{ padding: "6px 18px 14px" }}>
            {paidLessons.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line-2)", fontSize: 13.5 }}>
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                <span className="num" style={{ fontWeight: 600, whiteSpace: "nowrap", color: p.unpaid > 0 ? "var(--bad)" : p.left <= 2 ? "var(--warn)" : "var(--ok)" }}>
                  {p.unpaid > 0
                    ? t(locale, "cabinet.unpaidN", { n: p.unpaid })
                    : p.left > 0
                      ? t(locale, "cabinet.lessonsLeftN", { n: p.left })
                      : t(locale, "cabinet.packageEnded")}
                </span>
              </div>
            ))}
            <p className="mut" style={{ fontSize: 11.5, margin: "10px 0 0" }}>{t(locale, "cabinet.packageNote")}</p>
          </div>
        </div>
      )}
      </div>

        </>
      )}

{tab === "schedule" && (
        <>
      <div className="card">
        <div className="card-h">
          <h3>{t(locale, "cabinet.schedule")}</h3>
          {lessons.length > 0 && (
            <a className="btn ghost" href="/api/calendar" download="schedule.ics" style={{ padding: "5px 11px", fontSize: 12.5 }}>
              <Icon name="schedule" size={14} />
              {t(locale, "cabinet.addToCalendar")}
            </a>
          )}
        </div>
        <div style={{ padding: "6px 0" }}>
          {lessons.length === 0 && <div className="empty">{t(locale, "cabinet.noSchedule")}</div>}
          {lessons.map((l) => {
            const today = l.dayOfWeek === todayDow && started(l);
            return (
              <div className="list-row" key={l.id} style={today ? { background: "var(--accent-soft)" } : undefined}>
                <div style={{ width: 40, fontWeight: 700, color: today ? "var(--accent)" : undefined }}>
                  {dayShort(locale, l.dayOfWeek)}
                  {today && <span className="mut" style={{ display: "block", fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>{t(locale, "common.today")}</span>}
                </div>
                <div className="num" style={{ width: 54, fontWeight: 600 }}>{l.startTime}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: l.color, flex: "none" }} />
                    {l.groupName}
                  </div>
                  <div className="mut" style={{ fontSize: 12 }}>
                    {l.room}{l.teacherName ? ` · ${l.teacherName}` : ""}
                  </div>
                  {!started(l) && l.startsOn && (
                    <div style={{ fontSize: 11.5, marginTop: 2, color: "var(--warn)", fontWeight: 600 }}>
                      {t(locale, "cabinet.startsOn", { date: formatDate(l.startsOn) })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {makeups.length > 0 && (
        <div className="card">
          <div className="card-h">
            <h3>{t(locale, "makeup.title")}</h3>
            <span className="chip c-mut"><span className="d" />{makeups.length}</span>
          </div>
          <div style={{ padding: "6px 0" }}>
            {makeups.map((m) => (
              <div className="list-row" key={m.id}>
                <div className="num mut" style={{ width: 62, fontSize: 12, fontWeight: 600 }}>{formatDate(m.plannedAt)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: m.lesson.group.color, flex: "none" }} />
                    {m.lesson.group.name}
                  </div>
                  <div className="mut" style={{ fontSize: 12 }}>
                    {t(locale, "makeup.missed", { date: formatDate(m.missedDate) })}
                    {m.note ? ` · ${m.note}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mut" style={{ fontSize: 11.5, padding: "0 18px 14px", margin: 0 }}>
            {t(locale, "makeup.note")}
          </p>
        </div>
      )}

        </>
      )}

      {tab === "tests" && (
        <div className="card">
          <div className="card-h"><h3>{t(locale, "cabinet.tests")}</h3><span className="chip c-mut"><span className="d" />{tests.length}</span></div>
          <div style={{ padding: "6px 0" }}>
            {tests.length === 0 && <div className="empty">{t(locale, "cabinet.noTests")}</div>}
            {tests.map((tst) => {
              const pct = tst.attempt ? Math.round((tst.attempt.score / tst.maxScore) * 100) : null;
              const inner = (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: tst.subjectColor, flex: "none" }} />
                      {tst.title}
                    </div>
                    <div className="mut" style={{ fontSize: 12 }}>
                      {tst.subjectName ? `${tst.subjectName} · ` : ""}{tst.questions} {t(locale, "cabinet.questionsShort")}{tst.attempt ? ` · ${tst.attempt.correctCount}/${tst.attempt.total} ${t(locale, "cabinet.correctShort")}` : ""}
                    </div>
                  </div>
                  {tst.attempt ? (
                    <span className={`chip ${gradeChipClass(pct!)}`}><span className="d" />{tst.attempt.score}/{tst.maxScore}</span>
                  ) : tst.inProgress ? (
                    <span className="chip c-warn"><span className="d" />{t(locale, "cabinet.continueTest")}</span>
                  ) : tst.open ? (
                    <span className="chip c-ok"><span className="d" />{t(locale, "cabinet.take")}</span>
                  ) : (
                    <span className="chip c-mut"><span className="d" />{t(locale, "cabinet.afterLesson", { date: formatDate(tst.date) })}</span>
                  )}
                </>
              );
              return tst.attempt || tst.inProgress || tst.open ? (
                <Link key={tst.id} href={`/cabinet/test/${tst.id}`} className="list-row" style={{ textDecoration: "none", color: "inherit" }}>
                  {inner}
                </Link>
              ) : (
                <div key={tst.id} className="list-row" style={{ opacity: 0.6 }}>{inner}</div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "schedule" && topics.length > 0 && (
        <div className="card">
          <div className="card-h"><h3>{t(locale, "cabinet.coveredTopics")}</h3><span className="chip c-mut"><span className="d" />{topics.length}</span></div>
          <div style={{ padding: "6px 0" }}>
            {topics.map((ls) => (
              <div className="list-row" key={ls.id}>
                <div className="num mut" style={{ width: 62, fontSize: 12, fontWeight: 600 }}>{formatDate(ls.date)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{ls.topic}</div>
                  <div className="mut" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: ls.lesson.group.color, flex: "none" }} />
                    {ls.lesson.group.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

{tab === "tasks" && (
        <>
      <CabinetHomework items={hwItems} locale={locale} />

      {materials.length > 0 && (
        <div className="card">
          <div className="card-h"><h3>{t(locale, "cabinet.materials")}</h3><span className="chip c-mut"><span className="d" />{materials.length}</span></div>
          <div style={{ padding: "6px 0" }}>
            {materials.map((m) => (
              <a key={m.id} href={m.fileUrl} target="_blank" rel="noopener noreferrer" className="list-row" style={{ textDecoration: "none" }}>
                <div className="pay-ico" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><Icon name="export" size={16} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{m.title}</div>
                  <div className="mut" style={{ fontSize: 12 }}>{m.fileName}</div>
                </div>
                <span className="mut" style={{ fontSize: 12 }}>{formatDate(m.createdAt)}</span>
              </a>
            ))}
          </div>
        </div>
      )}

        </>
      )}

{tab === "rating" && (
        <div className="card">
          <div className="card-h">
            <h3>{t(locale, "rating.title")}</h3>
            <span className="chip c-mut"><span className="d" />{t(locale, "rating.thisMonth")}</span>
          </div>
          {student.groups.length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 18px 12px" }}>
              {student.groups.map((g) => (
                <Link
                  key={g.id}
                  href={`/cabinet?tab=rating&g=${g.id}`}
                  className={`chip ${g.id === ratingGroup?.id ? "c-ok" : "c-mut"}`}
                  style={{ textDecoration: "none" }}
                >
                  {g.name}
                </Link>
              ))}
            </div>
          )}
          {rating ? (
            <GroupRatingList rows={rating.rows} students={rating.students} meId={studentId} locale={locale} />
          ) : (
            <div className="empty">{t(locale, "rating.noGroup")}</div>
          )}
        </div>
      )}

{tab === "grades" && (
        <>
        {/* Зачёты: тема, когда, сдал / не сдал */}
        <div className="card">
          <div className="card-h">
            <h3>{t(locale, "zachet.title")}</h3>
            <span className="chip c-mut"><span className="d" />{zachetRows.length}</span>
          </div>
          <div style={{ padding: "6px 0" }}>
            <ZachetList rows={zachetRows} tz={tz} locale={locale} />
          </div>
        </div>

      {progress.length >= 2 && (
        <div className="card">
          <div className="card-h">
            <h3>{t(locale, "cabinet.howAreThings")}</h3>
            <span className="chip c-mut"><span className="d" />{t(locale, "cabinet.lastN", { n: progress.length })}</span>
          </div>
          <div style={{ padding: 18 }}>
            <BarChart data={progress} color="var(--violet)" height={150} formatValue={(n) => `${n}%`} />
            <p className="mut" style={{ fontSize: 12, margin: "10px 0 0" }}>
              {t(locale, "cabinet.progressNote")}
            </p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-h"><h3>{t(locale, "cabinet.grades")}</h3></div>
        <GradeMonthSummary studentId={studentId} tz={tz} locale={locale} />
        <div style={{ padding: "6px 0" }}>
          {student.grades.length === 0 && <div className="empty">{t(locale, "cabinet.noGrades")}</div>}
          {student.grades.map((g) => {
            const pct = Math.round((g.score / g.maxScore) * 100);
            return (
              <div className="list-row" key={g.id}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{g.topic}</div>
                  <div className="mut" style={{ fontSize: 12 }}>
                    {[g.group?.subject?.name ?? g.group?.name, gradeTypeLabel(locale, g.type), formatDate(g.date)]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <span className={`chip ${gradeChipClass(pct)}`}><span className="d" />{g.score}/{g.maxScore}</span>
              </div>
            );
          })}
        </div>
      </div>

      {attendance.length > 0 && (
        <div className="card">
          <div className="card-h">
            <h3>{t(locale, "cabinet.attendanceByLesson")}</h3>
            <span className="chip c-mut"><span className="d" />{attendance.length}</span>
          </div>
          <div style={{ padding: "6px 0" }}>
            {attendance.map((a) => {
              const label = a.present ? t(locale, "cabinet.present") : a.excused ? t(locale, "cabinet.excused") : t(locale, "cabinet.missed");
              const cls = a.present ? "c-ok" : a.excused ? "c-mut" : "c-bad";
              return (
                <div className="list-row" key={a.id}>
                  <div className="num mut" style={{ width: 62, fontSize: 12, fontWeight: 600 }}>{formatDate(a.date)}</div>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: a.lesson.group.color, flex: "none" }} />
                    <span style={{ fontWeight: 600 }}>{a.lesson.group.name}</span>
                  </div>
                  <span className={`chip ${cls}`}><span className="d" />{label}</span>
                </div>
              );
            })}
          </div>
          <p className="mut" style={{ fontSize: 11.5, padding: "0 18px 14px", margin: 0 }}>
            {t(locale, "cabinet.excusedNote")}
          </p>
        </div>
      )}

        </>
      )}

      <p style={{ textAlign: "center" }}>
        <Link href={tab === "home" ? "/cabinet" : `/cabinet?tab=${tab}`} className="mut" style={{ fontSize: 11.5 }}>{t(locale, "common.refresh")}</Link>
      </p>
    </div>
  );
}
