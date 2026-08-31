import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEdit } from "@/lib/roles";
import { isTeacher } from "@/lib/teacher";
import { LEAD_STAGES, formatDate } from "@/lib/format";
import { ModalButton } from "@/components/ModalButton";
import Link from "next/link";
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

  // Ближайшие пробные уроки и запланированные действия (для открытых лидов)
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const openLeads = leads.filter((l) => l.stage !== "WON" && l.stage !== "LOST");
  type Agenda = { id: string; name: string; kind: "trial" | "action"; date: Date; overdue: boolean; label: string };
  const agenda: Agenda[] = [];
  for (const l of openLeads) {
    if (l.trialDate)
      agenda.push({ id: l.id, name: l.name, kind: "trial", date: l.trialDate, overdue: l.trialDate < dayStart, label: "Пробный урок" });
    if (l.nextActionAt)
      agenda.push({ id: l.id, name: l.name, kind: "action", date: l.nextActionAt, overdue: l.nextActionAt < dayStart, label: "Следующее действие" });
  }
  agenda.sort((a, b) => a.date.getTime() - b.date.getTime());

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

      {agenda.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-h">
            <h3>Пробные уроки и задачи</h3>
            <span className="chip c-mut"><span className="d" />{agenda.length}</span>
          </div>
          <div style={{ padding: "6px 0" }}>
            {agenda.slice(0, 12).map((a, i) => (
              <Link key={`${a.id}-${a.kind}-${i}`} href={`/leads/${a.id}`} className="list-row" style={{ textDecoration: "none" }}>
                <span className={`chip ${a.kind === "trial" ? "c-vio" : a.overdue ? "c-bad" : "c-mut"}`} style={{ minWidth: 118, justifyContent: "center" }}>
                  <span className="d" />{a.label}
                </span>
                <div style={{ flex: 1, fontWeight: 600 }}>{a.name}</div>
                <span className="mut" style={{ fontSize: 12.5, color: a.overdue ? "var(--bad)" : undefined, fontWeight: a.overdue ? 700 : undefined }}>
                  {a.overdue ? "просрочено · " : ""}{formatDate(a.date)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

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
