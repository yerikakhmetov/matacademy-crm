"use client";

import { useTransition } from "react";
import { toggleHomeworkDone } from "@/app/actions/data";
import { initials } from "@/lib/format";

type S = { id: string; name: string; done: boolean; fileUrl?: string | null; fileName?: string | null };

export function HomeworkStudents({ homeworkId, students, canManage }: { homeworkId: string; students: S[]; canManage: boolean }) {
  const [pending, start] = useTransition();

  return (
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
      {students.map((s) => (
        <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
          <button
            type="button"
            disabled={!canManage || pending}
            onClick={() => canManage && start(() => toggleHomeworkDone(homeworkId, s.id))}
            className={`chip ${s.done ? "c-ok" : "c-mut"}`}
            style={{ cursor: canManage ? "pointer" : "default", padding: "4px 10px", opacity: pending ? 0.6 : 1 }}
            title={s.done ? `${s.name} — выполнил, нажмите, чтобы снять` : `${s.name} — не выполнил, нажмите, чтобы отметить`}
          >
            <span className="d" />
            {s.done ? "✓ " : ""}
            {initials(s.name)}
          </button>
          {s.fileUrl && (
            <a
              href={s.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`Работа: ${s.fileName ?? "файл"}`}
              className="chip c-ok"
              style={{ padding: "4px 7px", textDecoration: "none" }}
            >
              📎
            </a>
          )}
        </span>
      ))}
      {students.length === 0 && <span className="mut" style={{ fontSize: 12.5 }}>в группе нет учеников</span>}
    </div>
  );
}
