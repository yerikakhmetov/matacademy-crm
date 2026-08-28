"use client";

import { useRef, useTransition } from "react";
import { addLeadActivity } from "@/app/actions/data";
import { Icon } from "@/components/Icon";

export function AddActivity({ leadId }: { leadId: string }) {
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(fd) =>
        start(async () => {
          await addLeadActivity(leadId, fd);
          formRef.current?.reset();
        })
      }
      style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--line-2)" }}
    >
      <div className="field row">
        <select name="type" defaultValue="CALL" style={selStyle}>
          <option value="CALL">📞 Звонок</option>
          <option value="TASK">✓ Задача</option>
          <option value="NOTE">✎ Заметка</option>
        </select>
        <input name="dueDate" type="date" style={selStyle} title="Срок (для задачи)" />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input name="text" required placeholder="Что сделать / что обсудили…" style={{ ...selStyle, flex: 1 }} />
        <button className="btn" type="submit" disabled={pending}>
          <Icon name="plus" size={16} />
          {pending ? "…" : "Добавить"}
        </button>
      </div>
    </form>
  );
}

const selStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 9,
  padding: "9px 12px",
  fontSize: 13.5,
  color: "var(--ink)",
};
