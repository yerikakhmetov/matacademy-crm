"use client";

import { useState, useTransition } from "react";
import { deleteGroup } from "@/app/actions/groups";

export function DeleteGroupButton({ id, name, hasStudents }: { id: string; name: string; hasStudents: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  if (!confirm) {
    return (
      // редкое и опасное действие: тихая ссылка справа, а не кнопка наравне с «Редактировать»
      <button className="link-danger" type="button" onClick={() => setConfirm(true)} style={{ marginLeft: "auto" }}>
        Удалить
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginLeft: "auto" }}>
      <span className="mut" style={{ fontSize: 12 }}>
        {hasStudents ? "Ученики открепятся. Удалить?" : "Удалить?"}
      </span>
      <button className="btn ghost" type="button" disabled={pending} onClick={() => setConfirm(false)} style={{ padding: "5px 10px", fontSize: 12.5 }}>
        Нет
      </button>
      <button className="btn danger" type="button" disabled={pending} onClick={() => start(() => deleteGroup(id))} style={{ padding: "5px 10px", fontSize: 12.5 }} title={`Удалить группу ${name}`}>
        {pending ? "…" : "Да"}
      </button>
    </div>
  );
}
