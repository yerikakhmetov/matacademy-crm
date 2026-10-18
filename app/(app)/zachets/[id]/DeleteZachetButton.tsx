"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteZachet } from "@/app/actions/zachets";

// Удаление зачёта вместе с отметками — с подтверждением.
export function DeleteZachetButton({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!confirm) {
    return (
      <button type="button" className="link-danger" onClick={() => setConfirm(true)}>
        Удалить зачёт
      </button>
    );
  }
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <span className="mut" style={{ fontSize: 12.5 }}>Удалить вместе с отметками?</span>
      <button type="button" className="btn ghost" disabled={pending} onClick={() => setConfirm(false)}>
        Нет
      </button>
      <button
        type="button"
        className="btn danger"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await deleteZachet(id);
            if (r?.error) setError(r.error);
            else router.push("/zachets");
          })
        }
      >
        {pending ? "…" : "Да, удалить"}
      </button>
      {error && <span role="alert" style={{ color: "var(--bad)", fontSize: 12 }}>{error}</span>}
    </span>
  );
}
