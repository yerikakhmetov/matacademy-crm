"use client";

import { useState, useTransition } from "react";
import { toggleMyHomework } from "@/app/actions/data";
import { Icon } from "@/components/Icon";

export type CabinetHW = {
  id: string;
  title: string;
  groupName: string;
  dueLabel: string | null;
  dueTs: number | null;
  done: boolean;
};

// Список ДЗ в кабинете ученика с возможностью отметить «выполнено» (оптимистично).
export function CabinetHomework({ items }: { items: CabinetHW[] }) {
  const [done, setDone] = useState<Record<string, boolean>>(
    Object.fromEntries(items.map((h) => [h.id, h.done]))
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

  const toggle = (id: string) => {
    if (busy) return;
    const prev = done[id];
    setBusy(id);
    setDone((s) => ({ ...s, [id]: !prev })); // оптимистично
    start(async () => {
      try {
        const res = await toggleMyHomework(id);
        setDone((s) => ({ ...s, [id]: res.done }));
      } catch {
        setDone((s) => ({ ...s, [id]: prev })); // откат при ошибке
      } finally {
        setBusy(null);
      }
    });
  };

  return (
    <div className="card">
      <div className="card-h">
        <h3>Домашние задания</h3>
        <span className="chip c-mut"><span className="d" />{items.length}</span>
      </div>
      <div style={{ padding: "6px 0" }}>
        {items.length === 0 && <div className="empty">Заданий пока нет</div>}
        {items.map((hw) => {
          const isDone = done[hw.id];
          const overdue = hw.dueTs != null && hw.dueTs < Date.now() && !isDone;
          const loading = busy === hw.id;
          return (
            <div className="list-row" key={hw.id}>
              <button
                type="button"
                onClick={() => toggle(hw.id)}
                disabled={loading}
                aria-pressed={isDone}
                title={isDone ? "Отметить невыполненным" : "Отметить выполненным"}
                style={{
                  width: 24,
                  height: 24,
                  flex: "none",
                  borderRadius: 7,
                  border: `1.5px solid ${isDone ? "var(--ok)" : "var(--line)"}`,
                  background: isDone ? "var(--ok)" : "transparent",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  cursor: loading ? "default" : "pointer",
                  opacity: loading ? 0.5 : 1,
                }}
              >
                {isDone && <Icon name="check" size={14} />}
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, textDecoration: isDone ? "line-through" : "none", color: isDone ? "var(--ink-3)" : "inherit" }}>
                  {hw.title}
                </div>
                <div className="mut" style={{ fontSize: 12 }}>
                  {hw.groupName}{hw.dueLabel ? ` · срок: ${hw.dueLabel}` : ""}
                </div>
              </div>
              <span className={`chip ${isDone ? "c-ok" : overdue ? "c-bad" : "c-mut"}`}>
                <span className="d" />{isDone ? "Выполнено" : overdue ? "Просрочено" : "Активно"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
