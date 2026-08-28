"use client";

import { useTransition } from "react";
import { toggleLeadTask } from "@/app/actions/data";

export function LeadTaskToggle({ id, done }: { id: string; done: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => toggleLeadTask(id))}
      className={`chip ${done ? "c-ok" : "c-warn"}`}
      style={{ cursor: "pointer", padding: "3px 10px", opacity: pending ? 0.6 : 1 }}
      title={done ? "Отметить невыполненной" : "Отметить выполненной"}
    >
      <span className="d" />
      {done ? "Выполнено" : "Выполнить"}
    </button>
  );
}
