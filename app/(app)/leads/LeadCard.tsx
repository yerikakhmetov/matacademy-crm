"use client";

import Link from "next/link";
import { useTransition } from "react";
import { moveLead } from "@/app/actions/data";
import { LEAD_STAGES } from "@/lib/format";

const ORDER = LEAD_STAGES.map((s) => s.key);

export function LeadCard({
  lead,
  editor,
}: {
  lead: { id: string; name: string; childName: string | null; grade: string | null; subject: string | null; source: string | null; stage: string; tasks?: number };
  editor: boolean;
}) {
  const [pending, start] = useTransition();
  const idx = ORDER.indexOf(lead.stage);

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
