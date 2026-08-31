"use client";

import Link from "next/link";
import { useTransition } from "react";
import { moveLead } from "@/app/actions/data";
import { LEAD_STAGES, formatDate } from "@/lib/format";

const ORDER = LEAD_STAGES.map((s) => s.key);
const dayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

export function LeadCard({
  lead,
  editor,
}: {
  lead: { id: string; name: string; childName: string | null; grade: string | null; subject: string | null; source: string | null; stage: string; tasks?: number; trialDate?: Date | string | null; nextActionAt?: Date | string | null };
  editor: boolean;
}) {
  const [pending, start] = useTransition();
  const idx = ORDER.indexOf(lead.stage);
  const nextOverdue = lead.nextActionAt ? new Date(lead.nextActionAt) < dayStart() : false;

  const move = (dir: -1 | 1) => {
    const next = ORDER[idx + dir];
    if (next) start(() => void moveLead(lead.id, next));
  };

  return (
    <div className="lead" style={pending ? { opacity: 0.5 } : undefined}>
      <Link href={`/leads/${lead.id}`} className="ln" style={{ display: "block" }}>
        {lead.name}
      </Link>
      <div className="lc">
        {lead.grade ?? ""}
        {lead.subject ? ` · ${lead.subject}` : ""}
      </div>
      {(lead.trialDate || lead.nextActionAt) && (
        <div className="lead-dates" style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "6px 0 2px" }}>
          {lead.trialDate && (
            <span className="chip c-vio" style={{ padding: "1px 7px", fontSize: 10.5 }}>
              <span className="d" />Пробный {formatDate(lead.trialDate)}
            </span>
          )}
          {lead.nextActionAt && (
            <span className={`chip ${nextOverdue ? "c-bad" : "c-mut"}`} style={{ padding: "1px 7px", fontSize: 10.5 }}>
              <span className="d" />{nextOverdue ? "Просрочено " : "Действие "}{formatDate(lead.nextActionAt)}
            </span>
          )}
        </div>
      )}
      <div className="lead-foot">
        <span className="src">{lead.source ?? "—"}</span>
        {lead.tasks ? <span className="chip c-warn" style={{ padding: "1px 7px", fontSize: 10.5 }}><span className="d" />{lead.tasks}</span> : null}
        {editor && (
          <div className="movebtns">
            <button type="button" onClick={() => move(-1)} disabled={pending || idx <= 0} title="Назад">
              ←
            </button>
            <button type="button" onClick={() => move(1)} disabled={pending || idx >= ORDER.length - 1} title="Дальше">
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
