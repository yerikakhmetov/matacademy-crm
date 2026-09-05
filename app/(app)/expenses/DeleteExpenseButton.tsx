"use client";

import { useState, useTransition } from "react";
import { deleteExpense } from "@/app/actions/data";

export function DeleteExpenseButton({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  if (!confirm) {
    return (
      <button className="btn ghost" type="button" onClick={() => setConfirm(true)} style={{ padding: "5px 11px", fontSize: 12.5 }}>
        Удалить
      </button>
    );
  }
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
      <button className="btn ghost" type="button" onClick={() => setConfirm(false)} disabled={pending} style={{ padding: "5px 9px", fontSize: 12.5 }}>
        Нет
      </button>
      <button
        className="btn danger"
        type="button"
        disabled={pending}
        onClick={() => start(() => deleteExpense(id))}
        style={{ padding: "5px 9px", fontSize: 12.5 }}
      >
        {pending ? "…" : "Да"}
      </button>
    </div>
  );
}
