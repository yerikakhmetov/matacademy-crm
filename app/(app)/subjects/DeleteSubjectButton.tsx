"use client";

import { useState, useTransition } from "react";
import { deleteSubject } from "@/app/actions/data";

export function DeleteSubjectButton({ id, name, used }: { id: string; name: string; used: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  if (!confirm) {
    return (
      <button className="btn ghost" type="button" onClick={() => setConfirm(true)} style={{ color: "var(--bad)", padding: "5px 10px", fontSize: 12.5 }}>
        Удалить
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <span className="mut" style={{ fontSize: 12 }}>
        {used ? "В проданных абонементах название сохранится. Удалить?" : "Удалить?"}
      </span>
      <button className="btn ghost" type="button" disabled={pending} onClick={() => setConfirm(false)} style={{ padding: "5px 10px", fontSize: 12.5 }}>
        Нет
      </button>
      <button className="btn danger" type="button" disabled={pending} onClick={() => start(() => deleteSubject(id))} style={{ padding: "5px 10px", fontSize: 12.5 }} title={`Удалить ${name}`}>
        {pending ? "…" : "Да"}
      </button>
    </div>
  );
}
