import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEdit } from "@/lib/roles";
import { isTeacher } from "@/lib/teacher";
import { LEAD_STAGES } from "@/lib/format";
import { ModalButton } from "@/components/ModalButton";
import { LeadForm } from "./LeadForm";
import { LeadCard } from "./LeadCard";
import { createLead } from "@/app/actions/data";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const session = await auth();
  if (isTeacher(session?.user?.role)) redirect("/dashboard");
  const editor = canEdit(session?.user?.role);

  const leads = await prisma.lead.findMany({
    include: { _count: { select: { activities: { where: { done: false, type: "TASK" } } } } },
    orderBy: { createdAt: "desc" },
  });

  const active = leads.filter((l) => l.stage !== "WON" && l.stage !== "LOST").length;
  const won = leads.filter((l) => l.stage === "WON").length;
  const conv = leads.length > 0 ? Math.round((won / leads.length) * 100) : 0;

  // Конверсия по источникам
  const sources = new Map<string, { total: number; won: number }>();
  for (const l of leads) {
    const key = l.source ?? "Без источника";
    const s = sources.get(key) ?? { total: 0, won: 0 };
    s.total++;
    if (l.stage === "WON") s.won++;
    sources.set(key, s);
  }
  const sourceRows = [...sources.entries()].sort((a, b) => b[1].total - a[1].total);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Лиды и продажи</h1>
          <p>
            {active} активных лидов · конверсия в оплату {conv}%
          </p>
        </div>
        {editor && (
          <ModalButton label="Новая заявка" title="Новая заявка" action={createLead}>
            <LeadForm />
          </ModalButton>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <h3>Конверсия по источникам</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Источник</th>
                <th className="right">Всего лидов</th>
                <th className="right">Оплатили</th>
                <th className="right">Конверсия</th>
                <th style={{ width: 160 }}>Доля</th>
              </tr>
            </thead>
            <tbody>
              {sourceRows.map(([name, s]) => {
                const pct = s.total > 0 ? Math.round((s.won / s.total) * 100) : 0;
                const c = pct >= 40 ? "var(--ok)" : pct >= 20 ? "var(--warn)" : "var(--bad)";
                return (
                  <tr key={name}>
                    <td style={{ fontWeight: 600 }}>{name}</td>
                    <td className="right num">{s.total}</td>
                    <td className="right num">{s.won}</td>
                    <td className="right num" style={{ fontWeight: 700, color: c }}>
                      {pct}%
                    </td>
                    <td>
                      <div className="bar">
                        <span style={{ width: `${pct}%`, background: c }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="kanban">
        {LEAD_STAGES.map((stage) => {
          const items = leads.filter((l) => l.stage === stage.key);
          return (
            <div className="kcol" key={stage.key}>
              <div className="kcol-h">
                <span className="stripe" style={{ background: stage.color }} />
                {stage.label}
                <span className="cnt num">{items.length}</span>
              </div>
              <div className="kcol-b">
                {items.map((lead) => (
                  <LeadCard key={lead.id} lead={{ ...lead, tasks: lead._count.activities }} editor={editor} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
