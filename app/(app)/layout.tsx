import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [students, leads] = await Promise.all([
    prisma.student.count({ where: { status: "ACTIVE" } }),
    prisma.lead.count({ where: { stage: { notIn: ["WON", "LOST"] } } }),
  ]);

  return (
    <div className="app">
      <Sidebar user={session.user} counts={{ students, leads }} />
      <div className="main">
        <Topbar />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
