import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { netRevenue } from "@/lib/revenue";
import { auth } from "@/auth";
import { isTeacher } from "@/lib/teacher";
import { getAccess } from "@/lib/access";
import { Icon } from "@/components/Icon";
import { money, initials, avatarColor, LEAD_STAGES } from "@/lib/format";
import { refreshOverdue } from "@/app/actions/data";
import { TeacherDashboard } from "./TeacherDashboard";

export const dynamic = "force-dynamic";

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default async function DashboardPage() {
  const session = await auth();
  if (isTeacher(session?.user?.role) && session?.user?.id) {
    return <TeacherDashboard userId={session.user.id} name={session.user.name} />;
  }

  const { can } = await getAccess();
  const showMoney = can("finance"); // менеджер без права «finance» не видит суммы

  await refreshOverdue(); // автопометка просроченных счетов

  const jsDay = new Date().getDay(); // 0=Вс..6=Сб
  const today = jsDay === 0 ? 0 : jsDay; // 1..6 = Пн..Сб

  const [activeStudents, revenue, newLeads, debtStudents, todayLessons, stageCounts, recentPays, overdue, pausedStudents] =
    await Promise.all([
      prisma.student.count({ where: { status: "ACTIVE" } }),
      netRevenue(monthStart()),
      prisma.lead.count({ where: { createdAt: { gte: monthStart() } } }),
      prisma.student.findMany({ where: { balance: { lt: 0 } }, select: { balance: true } }),
      prisma.lesson.findMany({ where: { dayOfWeek: today }, include: { group: { include: { teacher: true, students: true } } }, orderBy: { startTime: "asc" } }),
      prisma.lead.groupBy({ by: ["stage"], _count: true }),
      prisma.payment.findMany({ where: { paidAmount: { gt: 0 } }, include: { student: true }, orderBy: { date: "desc" }, take: 5 }),
      prisma.payment.findMany({ where: { status: "OVERDUE" }, include: { student: true } }),
      prisma.student.findMany({ where: { status: "PAUSED" }, take: 3 }),
    ]);

  const totalDebt = debtStudents.reduce((a, s) => a + s.balance, 0);
  const countByStage = (k: string) => stageCounts.find((s) => s.stage === k)?._count ?? 0;
  const totalLeadsAll = stageCounts.reduce((a, s) => a + s._count, 0);
  const wonCount = countByStage("WON");
  const conv = totalLeadsAll > 0 ? Math.round((wonCount / totalLeadsAll) * 100) : 0;

  const funnel = LEAD_STAGES.filter((s) => s.key !== "LOST").map((s) => ({ ...s, v: countByStage(s.key) }));
  const funnelMax = Math.max(1, ...funnel.map((f) => f.v));

  const kpis = [
    { l: "Активных учеников", v: String(activeStudents), t: "учатся сейчас", icon: "students", col: "var(--accent)", bg: "var(--accent-soft)" },
    ...(showMoney ? [{ l: "Доход за месяц", v: money(revenue), t: "оплачено", icon: "money", col: "var(--ok)", bg: "var(--ok-soft)" }] : []),
    { l: "Новых лидов", v: String(newLeads), t: `конверсия ${conv}%`, icon: "leads", col: "var(--violet)", bg: "var(--violet-soft)" },
    ...(showMoney ? [{ l: "Задолженность", v: money(totalDebt), t: `${debtStudents.length} учеников`, icon: "alert", col: "var(--bad)", bg: "var(--bad-soft)" }] : []),
  ];

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Доброе утро" : now.getHours() < 18 ? "Добрый день" : "Добрый вечер";
  const dateStr = now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{greeting} 👋</h1>
          <p>Сводка по школе на {dateStr}</p>
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
            <div className="ktrend">{k.t}</div>
          </div>
        ))}
      </div>

      <div className="two-col" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-h">
            <h3>Занятия сегодня</h3>
            <Link className="link" href="/schedule">
              Всё расписание →
            </Link>
          </div>
          <div style={{ padding: "6px 0" }}>
            {todayLessons.length === 0 && <div className="empty">Сегодня занятий нет 🎉</div>}
            {todayLessons.map((l) => (
              <div className="list-row" key={l.id}>
                <div style={{ width: 46, fontWeight: 700, fontSize: 13 }} className="num">
                  {l.startTime}
                </div>
                <div className="pay-ico" style={{ background: (l.group.color || "#3A5AE0") + "1f", color: l.group.color || "#3A5AE0" }}>
                  <Icon name="book" size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{l.group.name}</div>
                  <div className="mut" style={{ fontSize: 12 }}>
                    {l.group.teacher?.name ?? "—"} · {l.room}
                  </div>
                </div>
                <span className="chip c-mut">
                  <span className="d" />
                  {l.group.students.length} чел.
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>Воронка продаж</h3>
            <Link className="link" href="/leads">
              Канбан →
            </Link>
          </div>
          <div className="funnel">
            {funnel.map((f) => (
              <div className="frow" key={f.key}>
                <div className="fl">{f.label}</div>
                <div className="ftrack">
                  <div className="ffill" style={{ width: `${Math.round((f.v / funnelMax) * 100)}%`, background: f.color }}>
                    {f.v}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="two-col" style={{ marginTop: 16 }}>
        {showMoney && (
        <div className="card">
          <div className="card-h">
            <h3>Последние оплаты</h3>
            <Link className="link" href="/payments">
              Все оплаты →
            </Link>
          </div>
          <div style={{ padding: "6px 0" }}>
            {recentPays.length === 0 && <div className="empty">Пока нет оплат</div>}
            {recentPays.map((p) => (
              <div className="list-row" key={p.id}>
                <div className="av2" style={{ background: avatarColor(p.student.name) }}>
                  {initials(p.student.name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{p.student.name}</div>
                  <div className="mut" style={{ fontSize: 12 }}>
                    {p.purpose} · {p.method ?? "—"}
                  </div>
                </div>
                <div className="money num" style={{ color: "var(--ok)" }}>
                  +{money(p.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
        )}

        <div className="card">
          <div className="card-h">
            <h3>Требуют внимания</h3>
            <span className="chip c-bad">
              <span className="d" />
              {(showMoney ? overdue.length : 0) + pausedStudents.length} задач
            </span>
          </div>
          <div style={{ padding: "6px 0" }}>
            {showMoney && overdue.map((p) => (
              <div className="list-row" key={p.id}>
                <div className="pay-ico" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>
                  <Icon name="alert" size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {p.student.name} — долг {money(p.amount)}
                  </div>
                  <div className="mut" style={{ fontSize: 12 }}>
                    {p.purpose} · просрочено
                  </div>
                </div>
              </div>
            ))}
            {pausedStudents.map((s) => (
              <div className="list-row" key={s.id}>
                <div className="pay-ico" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
                  <Icon name="students" size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name} на паузе</div>
                  <div className="mut" style={{ fontSize: 12 }}>Связаться с родителями</div>
                </div>
              </div>
            ))}
            {(showMoney ? overdue.length : 0) + pausedStudents.length === 0 && <div className="empty">Всё под контролем ✅</div>}
          </div>
        </div>
      </div>
    </>
  );
}
