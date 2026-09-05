"use client";

import { useTransition } from "react";
import { cancelMakeup, completeMakeup } from "@/app/actions/data";
import { Icon } from "@/components/Icon";

export function MakeupButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
      <button
        className="btn"
        type="button"
        disabled={pending}
        onClick={() => start(() => completeMakeup(id))}
        style={{ padding: "5px 11px", fontSize: 12.5 }}
        title="Отработка проведена — ученику ставится посещение на эту дату"
      >
        <Icon name="check" size={14} />
        {pending ? "…" : "Провёл"}
      </button>
      <button
        className="btn ghost"
        type="button"
        disabled={pending}
        onClick={() => start(() => cancelMakeup(id))}
        style={{ padding: "5px 11px", fontSize: 12.5, color: "var(--bad)" }}
      >
        Отменить
      </button>
    </div>
  );
}
