import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getStudentIdForUser } from "@/lib/teacher";
import { formatDate, scoreColor, gradeChipClass, DAYS, GRADE_TYPE } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { CabinetHomework } from "./CabinetHomework";
import { isTestOpen, testAvailableAt } from "@/lib/tests";

export const dynamic = "force-dynamic";

export default async function CabinetHome() {
  const session = await auth();
  const studentId = await getStudentIdForUser(session?.user?.id);
  if (!studentId) {
    return <div className="card"><div className="empty">Профиль ученика не найден. Обратитесь в школу.</div></div>;
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
  const tests = testsRaw.map((t) => {
    const lessons = lessonsByGroup.get(t.groupId ?? "") ?? [];
    const attempt = t.attempts[0] ?? null;
    return {
      id: t.id,
      title: t.title,
      date: t.date,
      maxScore: t.maxScore,
      questions: t._count.questions,
      subjectName: t.subject?.name ?? null,
      subjectColor: t.subject?.color ?? "#3A5AE0",
      attempt,
      open: isTestOpen(t.date, lessons),
      opensAt: testAvailableAt(t.date, lessons),
    };
  });

  const topics = groupIds.length
    ? await prisma.lessonSession.findMany({
        where: { lesson: { groupId: { in: groupIds } } },
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

  const now = new Date();
  const jsDay = now.getDay(); // 0 = вс
  const todayDow = jsDay === 0 ? 7 : jsDay; // 1..6 = Пн..Сб (как в расписании)
  const hour = now.getHours();
  const greeting = hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card" style={{ padding: 20, display: "flex", alignItems: "center", gap: 14 }}>
        <Avatar name={student.name} photoUrl={student.photoUrl} size={52} radius={14} fontSize={18} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 20 }}>{greeting}, {student.name.split(" ")[0]}!</h1>
          <p className="mut" style={{ fontSize: 13, margin: "2px 0 0" }}>
            {student.groups.map((g) => g.name).join(", ") || "без группы"}
          </p>
        </div>
      </div>

      <div className="grid kpis" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
        <div className="card kpi">
          <div className="klabel"><span className="kico" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}><Icon name="check" size={16} /></span>Посещаемость</div>
          <div className="kval num" style={{ color: student.attendance == null ? "var(--ink-3)" : scoreColor(student.attendance) }}>{student.attendance == null ? "—" : `${student.attendance}%`}</div>
        </div>
        <div className="card kpi">
          <div className="klabel"><span className="kico" style={{ background: "var(--violet-soft)", color: "var(--violet)" }}><Icon name="chart" size={16} /></span>Средний балл</div>
          <div className="kval num" style={{ color: avg != null ? scoreColor(avg) : "var(--ink-3)" }}>{avg != null ? `${avg}%` : "—"}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h3>Расписание</h3></div>
        <div style={{ padding: "6px 0" }}>
          {lessons.length === 0 && <div className="empty">Расписание не задано</div>}
          {lessons.map((l) => {
            const today = l.dayOfWeek === todayDow;
            return (
              <div className="list-row" key={l.id} style={today ? { background: "var(--accent-soft)" } : undefined}>
                <div style={{ width: 40, fontWeight: 700, color: today ? "var(--accent)" : undefined }}>
                  {DAYS[l.dayOfWeek]}
                  {today && <span className="mut" style={{ display: "block", fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>сегодня</span>}
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
          <div className="card-h"><h3>Тесты</h3><span className="chip c-mut"><span className="d" />{tests.length}</span></div>
          <div style={{ padding: "6px 0" }}>
            {tests.map((t) => {
              const pct = t.attempt ? Math.round((t.attempt.score / t.maxScore) * 100) : null;
              const inner = (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: t.subjectColor, flex: "none" }} />
                      {t.title}
                    </div>
                    <div className="mut" style={{ fontSize: 12 }}>
                      {t.subjectName ? `${t.subjectName} · ` : ""}{t.questions} вопр.{t.attempt ? ` · ${t.attempt.correctCount}/${t.attempt.total} верно` : ""}
                    </div>
                  </div>
                  {t.attempt ? (
                    <span className={`chip ${gradeChipClass(pct!)}`}><span className="d" />{t.attempt.score}/{t.maxScore}</span>
                  ) : t.open ? (
                    <span className="chip c-ok"><span className="d" />Пройти →</span>
                  ) : (
                    <span className="chip c-mut"><span className="d" />После урока {formatDate(t.date)}</span>
                  )}
                </>
              );
              return t.attempt || t.open ? (
                <Link key={t.id} href={`/cabinet/test/${t.id}`} className="list-row" style={{ textDecoration: "none", color: "inherit" }}>
                  {inner}
                </Link>
              ) : (
                <div key={t.id} className="list-row" style={{ opacity: 0.6 }}>{inner}</div>
              );
            })}
          </div>
        </div>
      )}

      {topics.length > 0 && (
        <div className="card">
          <div className="card-h"><h3>Пройденные темы</h3><span className="chip c-mut"><span className="d" />{topics.length}</span></div>
          <div style={{ padding: "6px 0" }}>
            {topics.map((t) => (
              <div className="list-row" key={t.id}>
                <div className="num mut" style={{ width: 62, fontSize: 12, fontWeight: 600 }}>{formatDate(t.date)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{t.topic}</div>
                  <div className="mut" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: t.lesson.group.color, flex: "none" }} />
                    {t.lesson.group.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <CabinetHomework items={hwItems} />

      {materials.length > 0 && (
        <div className="card">
          <div className="card-h"><h3>Материалы</h3><span className="chip c-mut"><span className="d" />{materials.length}</span></div>
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

      <div className="card">
        <div className="card-h"><h3>Оценки</h3></div>
        <div style={{ padding: "6px 0" }}>
          {student.grades.length === 0 && <div className="empty">Оценок пока нет</div>}
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

      <p style={{ textAlign: "center" }}>
        <Link href="/cabinet" className="mut" style={{ fontSize: 11.5 }}>Обновить</Link>
      </p>
    </div>
  );
}
