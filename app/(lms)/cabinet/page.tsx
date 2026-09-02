import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getStudentIdForUser } from "@/lib/teacher";
import { formatDate, scoreColor, gradeChipClass, DAYS, GRADE_TYPE } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { CabinetHomework } from "./CabinetHomework";

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
    .flatMap((g) => g.lessons.map((l) => ({ ...l, groupName: g.name })))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));

  const hour = new Date().getHours();
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
          {lessons.map((l) => (
            <div className="list-row" key={l.id}>
              <div style={{ width: 40, fontWeight: 700 }}>{DAYS[l.dayOfWeek]}</div>
              <div className="num" style={{ width: 54, fontWeight: 600 }}>{l.startTime}</div>
              <div style={{ flex: 1 }} className="mut">{l.groupName} · {l.room}</div>
            </div>
          ))}
        </div>
      </div>

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
