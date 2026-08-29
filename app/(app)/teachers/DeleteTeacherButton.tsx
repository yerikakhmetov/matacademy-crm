"use client";

import { useState, useTransition } from "react";
import { deleteTeacher } from "@/app/actions/data";

export function DeleteTeacherButton({ id, name, hasGroups }: { id: string; name: string; hasGroups: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  if (!confirm) {
    return (
      <button className="btn ghost" type="button" onClick={() => setConfirm(true)} style={{ color: "var(--bad)" }}>
        Удалить
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <span className="mut" style={{ fontSize: 12 }}>
        {hasGroups ? "Группы останутся без учителя. Удалить?" : "Удалить?"}
      </span>
      <button className="btn ghost" type="button" disabled={pending} onClick={() => setConfirm(false)} style={{ padding: "5px 10px", fontSize: 12.5 }}>
        Нет
      </button>
      <button className="btn danger" type="button" disabled={pending} onClick={() => start(() => deleteTeacher(id))} style={{ padding: "5px 10px", fontSize: 12.5 }} title={`Удалить ${name}`}>
        {pending ? "…" : "Да"}
      </button>
    </div>
  );
}
