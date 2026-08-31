import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { money } from "@/lib/format";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000);
}

export default async function StatsPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [
    users, students, activeStudents, groups, teachers, leads,
    paidAgg, subs, parentsLinked, teacherLogins, changes7d, newStudents30d, grades, homework, attendance,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.student.count(),
    prisma.student.count({ where: { status: "ACTIVE" } }),
    prisma.group.count(),
    prisma.teacher.count(),
    prisma.lead.count(),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID" } }),
    prisma.subscription.count(),
    prisma.student.count({ where: { telegramChatId: { not: null } } }),
    prisma.user.count({ where: { telegramUserId: { not: null } } }),
    prisma.auditLog.count({ where: { createdAt: { gte: daysAgo(7) } } }),
    prisma.student.count({ where: { createdAt: { gte: daysAgo(30) } } }),
    prisma.grade.count(),
    prisma.homework.count().catch(() => 0),
    prisma.attendance.count(),
  ]);

  const usersByRole = await prisma.user.groupBy({ by: ["role"], _count: true });
  const roleCount = (r: string) => usersByRole.find((x) => x.role === r)?._count ?? 0;

  const blocks: { title: string; icon: string; col: string; bg: string; items: { k: string; v: string }[] }[] = [
    {
      title: "Ученики",
      icon: "students",
      col: "var(--accent)",
      bg: "var(--accent-soft)",
      items: [
        { k: "Всего", v: String(students) },
        { k: "Активных", v: String(activeStudents) },
        { k: "Новых за 30 дней", v: String(newStudents30d) },
      ],
    },
    {
      title: "Учебный процесс",
      icon: "book",
      col: "var(--violet)",
      bg: "var(--violet-soft)",
      items: [
        { k: "Группы", v: String(groups) },
        { k: "Преподаватели", v: String(teachers) },
        { k: "Оценки", v: String(grades) },
        { k: "Отметки посещаемости", v: String(attendance) },
        { k: "Домашних заданий", v: String(homework) },
      ],
    },
    {
      title: "Финансы",
      icon: "money",
      col: "var(--ok)",
      bg: "var(--ok-soft)",
      items: [
        { k: "Всего оплачено", v: money(paidAgg._sum.amount ?? 0) },
        { k: "Абонементов", v: String(subs) },
        { k: "Лидов", v: String(leads) },
      ],
    },
    {
      title: "Доступ и связь",
      icon: "check",
      col: "var(--teal)",
      bg: "var(--teal-soft)",
      items: [
        { k: "Пользователей", v: String(users) },
        { k: "Админы / Менеджеры / Учителя", v: `${roleCount("ADMIN")} / ${roleCount("MANAGER")} / ${roleCount("TEACHER")}` },
        { k: "Родителей в Telegram", v: String(parentsLinked) },
        { k: "Учителей с Telegram-входом", v: String(teacherLogins) },
        { k: "Изменений за 7 дней", v: String(changes7d) },
      ],
    },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Статистика системы</h1>
          <p>Общая картина по школе</p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        {blocks.map((b) => (
          <div className="card" key={b.title}>
            <div className="card-h">
              <h3 style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="kico" style={{ background: b.bg, color: b.col, width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center" }}>
                  <Icon name={b.icon} size={16} />
                </span>
                {b.title}
              </h3>
            </div>
            <div style={{ padding: "6px 0" }}>
              {b.items.map((it) => (
                <div className="list-row" key={it.k} style={{ padding: "10px 18px" }}>
                  <div style={{ flex: 1 }} className="mut">{it.k}</div>
                  <div className="num" style={{ fontWeight: 700 }}>{it.v}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
