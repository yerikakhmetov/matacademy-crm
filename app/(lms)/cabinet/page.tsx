import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getStudentIdForUser } from "@/lib/teacher";
import { formatDate, scoreColor, gradeChipClass, GRADE_TYPE } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { BarChart } from "@/components/BarChart";
import { CabinetHomework } from "./CabinetHomework";
import { isTestOpen, testAvailableAt } from "@/lib/tests";
import { getSettings } from "@/lib/settings";
import { getLocale } from "@/lib/locale";
import { dayShort, t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function CabinetHome() {
  const session = await auth();
  const locale = await getLocale();
  const studentId = await getStudentIdForUser(session?.user?.id);
  if (!studentId) {
    return <div className="card"><div className="empty">{t(locale, "cabinet.profileNotFound")}</div></div>;
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      groups: { include: { teacher: true, lessons: true } },
      grades: { orderBy: { date: "desc" }, take: 10 },
    },
  });
  if (!student) redirect("/login");

  const groupIds = student.groups.map((g) => g.id);
  const homeworks = groupIds.length
    ? await prisma.homework.findMany({
        where: { groupId: { in: groupIds } },
        orderBy: { createdAt: "desc" },
        take: 6,
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
        where: { groupId: { in: groupIds }, questions: { some: {} } },
        orderBy: { date: "desc" },
        take: 12,
        include: {
          _count: { select: { questions: true } },
          attempts: { where: { studentId }, select: { score: true, correctCount: true, total: true } },
          subject: { select: { name: true, color: true } },
        },
      })
    : [];
  const lessonsByGroup = new Map(student.groups.map((g) => [g.id, g.lessons.map((l) => ({ dayOfWeek: l.dayOfWeek, startTime: l.startTime }))]));
  const tests = testsRaw.map((row) => {
    const lessons = lessonsByGroup.get(row.groupId ?? "") ?? [];
    const attempt = row.attempts[0] ?? null;
    return {
      id: row.id,
      title: row.title,
      date: row.date,
      maxScore: row.maxScore,
      questions: row._count.questions,
      subjectName: row.subject?.name ?? null,
      subjectColor: row.subject?.color ?? "#3A5AE0",
      attempt,
      open: isTestOpen(row.date, lessons, new Date(), tz),
      opensAt: testAvailableAt(row.date, lessons, tz),
    };
  });

  const attendance = await prisma.attendance.findMany({
    where: { studentId },
    orderBy: { date: "desc" },
    take: 20,
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

  const hwItems = homeworks.map((hw) => ({
    id: hw.id,
    title: hw.title,
    description: hw.description,
    groupName: hw.group.name,
    dueLabel: hw.dueDate ? formatDate(hw.dueDate) : null,
    dueTs: hw.dueDate ? new Date(hw.dueDate).getTime() : null,
    done: hw.completions[0]?.done ?? false,
  }));

  const avg = student.grades.length
    ? Math.round(student.grades.reduce((a, g) => a + (g.score / g.maxScore) * 100, 0) / student.grades.length)
    : null;
  const lessons = student.groups
    .flatMap((g) => g.lessons.map((l) => ({ ...l, groupName: g.name, color: g.color, teacherName: g.teacher?.name ?? null })))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));

  const shortDate = (d: Date) => `${d.getUTCDate()}.${d.getUTCMonth() + 1}`;
  const progress = [...student.grades]
    .reverse()
    .map((g) => ({ label: shortDate(new Date(g.date)), value: Math.round((g.score / g.maxScore) * 100) }));

  const now = new Date();
  const jsDay = now.getDay(); // 0 = вс
  const todayDow = jsDay === 0 ? 7 : jsDay; // 1..6 = Пн..Сб (как в расписании)
  const hour = now.getHours();
  const greeting = hour < 12 ? t(locale, "cabinet.morning") : hour < 18 ? t(locale, "cabinet.day") : t(locale, "cabinet.evening");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card" style={{ padding: 20, display: "flex", alignItems: "center", gap: 14 }}>
        <Avatar name={student.name} photoUrl={student.photoUrl} size={52} radius={14} fontSize={18} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 20 }}>{greeting}, {student.name.split(" ")[0]}!</h1>
          <p className="mut" style={{ fontSize: 13, margin: "2px 0 0" }}>
            {student.groups.map((g) => g.name).join(", ") || t(locale, "common.noGroup")}
          </p>
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
      </div>

      <div className="card">
        <div className="card-h"><h3>{t(locale, "cabinet.schedule")}</h3></div>
        <div style={{ padding: "6px 0" }}>
          {lessons.length === 0 && <div className="empty">{t(locale, "cabinet.noSchedule")}</div>}
          {lessons.map((l) => {
            const today = l.dayOfWeek === todayDow;
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
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {tests.length > 0 && (
        <div className="card">
          <div className="card-h"><h3>{t(locale, "cabinet.tests")}</h3><span className="chip c-mut"><span className="d" />{tests.length}</span></div>
          <div style={{ padding: "6px 0" }}>
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
                  ) : tst.open ? (
                    <span className="chip c-ok"><span className="d" />{t(locale, "cabinet.take")}</span>
                  ) : (
                    <span className="chip c-mut"><span className="d" />{t(locale, "cabinet.afterLesson", { date: formatDate(tst.date) })}</span>
                  )}
                </>
              );
              return tst.attempt || tst.open ? (
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

      {topics.length > 0 && (
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
        <div style={{ padding: "6px 0" }}>
          {student.grades.length === 0 && <div className="empty">{t(locale, "cabinet.noGrades")}</div>}
          {student.grades.map((g) => {
            const pct = Math.round((g.score / g.maxScore) * 100);
            return (
              <div className="list-row" key={g.id}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{g.topic}</div>
                  <div className="mut" style={{ fontSize: 12 }}>{GRADE_TYPE[g.type] ?? g.type} · {formatDate(g.date)}</div>
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

      <p style={{ textAlign: "center" }}>
        <Link href="/cabinet" className="mut" style={{ fontSize: 11.5 }}>{t(locale, "common.refresh")}</Link>
      </p>
    </div>
  );
}
