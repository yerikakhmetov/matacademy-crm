"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteTest } from "@/app/actions/data";

export function DeleteTestButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  if (!confirm) {
    return (
      <button className="btn ghost" type="button" onClick={() => setConfirm(true)} style={{ color: "var(--bad)" }}>
        Удалить тест
      </button>
    );
  }
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <span className="mut" style={{ fontSize: 12 }}>Удалить тест и все его оценки?</span>
      <button className="btn ghost" type="button" disabled={pending} onClick={() => setConfirm(false)} style={{ padding: "5px 10px", fontSize: 12.5 }}>
        Нет
      </button>
      <button
        className="btn danger"
        type="button"
        disabled={pending}
        onClick={() => start(async () => { await deleteTest(id); router.push("/tests"); })}
        style={{ padding: "5px 10px", fontSize: 12.5 }}
        title={`Удалить ${title}`}
      >
        {pending ? "…" : "Да"}
      </button>
    </div>
  );
}
