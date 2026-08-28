"use client";

import { useTransition } from "react";
import { moveLead } from "@/app/actions/data";
import { LEAD_STAGES } from "@/lib/format";

export function LeadStageBar({ leadId, current, editor }: { leadId: string; current: string; editor: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {LEAD_STAGES.map((s) => {
        const active = s.key === current;
        return (
          <button
            key={s.key}
            type="button"
            disabled={!editor || pending || active}
            onClick={() => start(() => void moveLead(leadId, s.key))}
            className="chip"
            style={{
              cursor: editor && !active ? "pointer" : "default",
              background: active ? s.color : "var(--surface-2)",
              color: active ? "#fff" : "var(--ink-2)",
              border: `1px solid ${active ? s.color : "var(--line)"}`,
              padding: "6px 12px",
              fontSize: 12.5,
              opacity: pending ? 0.6 : 1,
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
