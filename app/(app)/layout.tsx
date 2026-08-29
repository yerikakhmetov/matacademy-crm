import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSettings, parseList } from "@/lib/settings";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [students, leads, settings] = await Promise.all([
    prisma.student.count({ where: { status: "ACTIVE" } }),
    prisma.lead.count({ where: { stage: { notIn: ["WON", "LOST"] } } }),
    getSettings(),
  ]);
  const branch = parseList(settings.branches)[0];

  // Уведомления (для админа/менеджера)
  const notifications: { text: string; href: string; kind: string }[] = [];
  if (session.user.role !== "TEACHER") {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const in14 = new Date(Date.now() + 14 * 86400000);
    const [overdueCount, newLeadsWeek, expiringCount] = await Promise.all([
      prisma.payment.count({ where: { status: "OVERDUE" } }),
      prisma.lead.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.subscription.count({ where: { endDate: { gte: new Date(), lte: in14 } } }),
    ]);
    if (overdueCount) notifications.push({ text: `${overdueCount} просроченных оплат`, href: "/reminders", kind: "bad" });
    if (expiringCount) notifications.push({ text: `${expiringCount} абонементов истекают скоро`, href: "/reminders", kind: "warn" });
    if (newLeadsWeek) notifications.push({ text: `${newLeadsWeek} новых лидов за неделю`, href: "/leads", kind: "acc" });
  }

  return (
    <div className="app">
      <Sidebar user={session.user} counts={{ students, leads }} />
      <div className="main">
        <Topbar branch={branch} notifications={notifications} />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
