"use client";

import { useState, useTransition } from "react";
import { deleteUser } from "@/app/actions/data";

export function DeleteUserButton({ id, name }: { id: string; name: string }) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!confirm) {
    return (
      <button className="btn ghost" type="button" onClick={() => setConfirm(true)} style={{ padding: "5px 11px", fontSize: 12.5, color: "var(--bad)" }}>
        Удалить
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
      {error ? <span className="chip c-bad" style={{ fontSize: 11 }}><span className="d" />{error}</span> : <span className="mut" style={{ fontSize: 12 }}>Удалить {name}?</span>}
      <button className="btn ghost" type="button" disabled={pending} onClick={() => { setConfirm(false); setError(null); }} style={{ padding: "5px 10px", fontSize: 12.5 }}>
        Нет
      </button>
      <button
        className="btn danger"
        type="button"
        disabled={pending}
        style={{ padding: "5px 10px", fontSize: 12.5 }}
        onClick={() => start(async () => { try { await deleteUser(id); } catch (e) { setError(e instanceof Error ? e.message : "Ошибка"); } })}
      >
        {pending ? "…" : "Да"}
      </button>
    </div>
  );
}
