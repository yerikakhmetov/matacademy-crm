import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Icon } from "@/components/Icon";
import { DAYS } from "@/lib/format";

export async function TeacherDashboard({ userId, name }: { userId: string; name?: string | null }) {
  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  const teacherId = teacher?.id ?? "__none__";

  const jsDay = new Date().getDay();
  const today = jsDay === 0 ? 0 : jsDay;

  const [groups, todayLessons, students] = await Promise.all([
    prisma.group.findMany({
      where: { teacherId },
      include: { _count: { select: { students: true } }, lessons: true },
      orderBy: { name: "asc" },
    }),
    prisma.lesson.findMany({
      where: { dayOfWeek: today, group: { teacherId } },
      include: { group: { include: { students: true } } },
      orderBy: { startTime: "asc" },
    }),
    prisma.student.findMany({ where: { groups: { some: { teacherId } } }, select: { attendance: true } }),
  ]);

  const totalStudents = students.length;
  const avgAtt = totalStudents ? Math.round(students.reduce((a, s) => a + s.attendance, 0) / totalStudents) : 0;
  const weekLessons = groups.reduce((a, g) => a + g.lessons.length, 0);

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Доброе утро" : now.getHours() < 18 ? "Добрый день" : "Добрый вечер";
  const dateStr = now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
  const firstName = (name ?? "").split(" ")[0];

  const kpis = [
    { l: "Мои группы", v: String(groups.length), icon: "groups", col: "var(--accent)", bg: "var(--accent-soft)" },
    { l: "Моих учеников", v: String(totalStudents), icon: "students", col: "var(--violet)", bg: "var(--violet-soft)" },
    { l: "Средняя посещаемость", v: avgAtt + "%", icon: "check", col: "var(--ok)", bg: "var(--ok-soft)" },
    { l: "Занятий в неделю", v: String(weekLessons), icon: "schedule", col: "var(--teal)", bg: "var(--teal-soft)" },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{greeting}{firstName ? `, ${firstName}` : ""} 👋</h1>
          <p>Ваши занятия и группы на {dateStr}</p>
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
        <div className="card">
          <div className="card-h">
            <h3>Занятия сегодня</h3>
            <Link className="link" href="/schedule">
              Расписание →
            </Link>
          </div>
          <div style={{ padding: "6px 0" }}>
            {todayLessons.length === 0 && <div className="empty">Сегодня занятий нет 🎉</div>}
            {todayLessons.map((l) => (
              <Link href={`/schedule/${l.id}`} className="list-row" key={l.id} style={{ textDecoration: "none" }}>
                <div style={{ width: 46, fontWeight: 700, fontSize: 13 }} className="num">
                  {l.startTime}
                </div>
                <div className="pay-ico" style={{ background: (l.group.color || "#3A5AE0") + "1f", color: l.group.color || "#3A5AE0" }}>
                  <Icon name="book" size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{l.group.name}</div>
                  <div className="mut" style={{ fontSize: 12 }}>
                    {l.room} · нажмите, чтобы отметить посещаемость
                  </div>
                </div>
                <span className="chip c-mut">
                  <span className="d" />
                  {l.group.students.length} чел.
                </span>
              </Link>
            ))}
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
                  <div style={{ flex: 1 }}>
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
    </>
  );
}
