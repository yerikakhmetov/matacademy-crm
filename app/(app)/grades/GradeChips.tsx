"use client";

import { useTransition } from "react";
import { deleteGrade } from "@/app/actions/grades";
import { GRADE_TYPE, gradeChipClass } from "@/lib/format";

type G = { id: string; score: number; maxScore: number; topic: string; type: string; date: Date };

// дата оценки «12.10» — UTC-полночь, как хранятся даты без времени
const dm = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export function GradeChips({ grades, canManage }: { grades: G[]; canManage: boolean }) {
  const [pending, start] = useTransition();

  if (grades.length === 0) return <span className="mut" style={{ fontSize: 12.5 }}>нет оценок за этот период</span>;

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
            <span className="mut" style={{ fontWeight: 500 }}>{dm(new Date(g.date))}</span>
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
      {/* Все оценки списком: тема и тип видны и на телефоне, где подсказка по наведению не работает */}
      {grades.length > 0 && (
        <details style={{ width: "100%", marginTop: 4 }}>
          <summary className="mut" style={{ cursor: "pointer", fontSize: 12 }}>Все оценки ({grades.length})</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
            {grades.map((g) => {
              const pct = Math.round((g.score / g.maxScore) * 100);
              return (
                <div key={g.id} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 12.5, whiteSpace: "normal" }}>
                  <span className="num mut" style={{ width: 40, flex: "none" }}>{dm(new Date(g.date))}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {g.topic}
                    <span className="mut"> · {GRADE_TYPE[g.type] ?? g.type}</span>
                  </span>
                  <span className={`chip ${gradeChipClass(pct)}`} style={{ flex: "none" }}>
                    <span className="d" />
                    {g.score}/{g.maxScore}
                  </span>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
