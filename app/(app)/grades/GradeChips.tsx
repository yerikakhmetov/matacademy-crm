"use client";

import { useTransition } from "react";
import { deleteGrade } from "@/app/actions/data";
import { GRADE_TYPE, gradeChipClass } from "@/lib/format";

type G = { id: string; score: number; maxScore: number; topic: string; type: string };

export function GradeChips({ grades, canManage }: { grades: G[]; canManage: boolean }) {
  const [pending, start] = useTransition();

  if (grades.length === 0) return <span className="mut" style={{ fontSize: 12.5 }}>оценок пока нет</span>;

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {grades.map((g) => {
        const pct = Math.round((g.score / g.maxScore) * 100);
        return (
          <span
            key={g.id}
            className={`chip ${gradeChipClass(pct)}`}
            title={`${GRADE_TYPE[g.type] ?? g.type}: ${g.topic} — ${g.score}/${g.maxScore} (${pct}%)`}
            style={{ opacity: pending ? 0.5 : 1 }}
          >
            <span className="d" />
            {g.score}/{g.maxScore}
            {canManage && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Удалить оценку ${g.score}/${g.maxScore} («${g.topic}»)?`)) start(() => deleteGrade(g.id));
                }}
                style={{ marginLeft: 3, color: "inherit", fontWeight: 700, lineHeight: 1, opacity: 0.6 }}
                title="Удалить"
              >
                ×
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
