"use client";

import { useTransition } from "react";
import { toggleHomeworkDone } from "@/app/actions/data";
import { initials } from "@/lib/format";

type S = { id: string; name: string; done: boolean };

export function HomeworkStudents({ homeworkId, students, canManage }: { homeworkId: string; students: S[]; canManage: boolean }) {
  const [pending, start] = useTransition();

  return (
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
      {students.map((s) => (
        <button
          key={s.id}
          type="button"
          disabled={!canManage || pending}
          onClick={() => canManage && start(() => toggleHomeworkDone(homeworkId, s.id))}
          className={`chip ${s.done ? "c-ok" : "c-mut"}`}
          style={{ cursor: canManage ? "pointer" : "default", padding: "4px 10px", opacity: pending ? 0.6 : 1 }}
          title={s.done ? "Выполнил — нажмите, чтобы снять" : "Не выполнил — нажмите, чтобы отметить"}
        >
          <span className="d" />
          {s.done ? "✓ " : ""}
          {initials(s.name)}
        </button>
      ))}
      {students.length === 0 && <span className="mut" style={{ fontSize: 12.5 }}>в группе нет учеников</span>}
    </div>
  );
}
