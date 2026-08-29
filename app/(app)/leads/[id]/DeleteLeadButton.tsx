"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteLead } from "@/app/actions/data";

export function DeleteLeadButton({ id, name }: { id: string; name: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!confirm) {
    return (
      <button className="btn ghost" type="button" onClick={() => setConfirm(true)} style={{ color: "var(--bad)" }}>
        Удалить
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <span className="mut" style={{ fontSize: 12 }}>Удалить лид?</span>
      <button className="btn ghost" type="button" disabled={pending} onClick={() => setConfirm(false)} style={{ padding: "5px 10px", fontSize: 12.5 }}>
        Нет
      </button>
      <button
        className="btn danger"
        type="button"
        disabled={pending}
        style={{ padding: "5px 10px", fontSize: 12.5 }}
        title={`Удалить ${name}`}
        onClick={() => start(async () => { await deleteLead(id); router.push("/leads"); })}
      >
        {pending ? "…" : "Да"}
      </button>
    </div>
  );
}
