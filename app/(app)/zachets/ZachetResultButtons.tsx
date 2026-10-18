"use client";

import { useState, useTransition } from "react";
import { setZachetResult } from "@/app/actions/zachets";

// «Сдал / Не сдал» для одного ученика. Повторный клик по выбранному — снять отметку.
export function ZachetResultButtons({
  zachetId,
  studentId,
  passed,
}: {
  zachetId: string;
  studentId: string;
  passed: boolean | null;
}) {
  const [value, setValue] = useState<boolean | null>(passed);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const mark = (next: boolean) => {
    const target = value === next ? null : next;
    const prev = value;
    setValue(target); // сразу показываем выбор, при ошибке вернём
    setError(null);
    start(async () => {
      const r = await setZachetResult(zachetId, studentId, target);
      if (r?.error) {
        setValue(prev);
        setError(r.error);
      }
    });
  };

  const btn = (on: boolean, label: string, color: string, bg: string, next: boolean) => (
    <button
      type="button"
      className="btn ghost"
      disabled={pending}
      aria-pressed={on}
      onClick={() => mark(next)}
      style={{ minHeight: 40, padding: "6px 14px", ...(on ? { background: bg, color, borderColor: color, fontWeight: 700 } : {}) }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
      {btn(value === true, "Сдал", "var(--ok)", "var(--ok-soft)", true)}
      {btn(value === false, "Не сдал", "var(--bad)", "var(--bad-soft)", false)}
      {error && (
        <span role="alert" style={{ fontSize: 12, color: "var(--bad)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
