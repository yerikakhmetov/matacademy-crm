"use client";

import { useRef, useState, useTransition } from "react";
import { broadcastTelegram } from "@/app/actions/data";
import { Icon } from "@/components/Icon";

export function BroadcastForm({ groups, linkedCount }: { groups: { id: string; name: string }[]; linkedCount: number }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ sent: number; total: number; error?: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-h">
        <h3>Сообщение всем родителям</h3>
        <span className="chip c-acc">
          <span className="d" />
          {linkedCount} с Telegram
        </span>
      </div>
      <form
        ref={formRef}
        action={(fd) =>
          start(async () => {
            const r = await broadcastTelegram(fd);
            setResult(r);
            if (!r.error) formRef.current?.reset();
          })
        }
        style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select name="group" className="filter" defaultValue="all" style={{ minWidth: 200 }}>
            <option value="all">Все группы</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <textarea
          name="text"
          required
          rows={3}
          placeholder="Например: Уважаемые родители! 1 сентября занятий не будет."
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 9,
            padding: "10px 12px",
            fontSize: 14,
            color: "var(--ink)",
            resize: "vertical",
            fontFamily: "var(--font-manrope)",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn" type="submit" disabled={pending || linkedCount === 0}>
            <Icon name="bell" size={16} />
            {pending ? "Отправляем…" : "Отправить в Telegram"}
          </button>
          {result && (
            <span className={`chip ${result.error ? "c-bad" : "c-ok"}`}>
              <span className="d" />
              {result.error ? result.error : `Отправлено: ${result.sent} из ${result.total}`}
            </span>
          )}
        </div>
        <p className="mut" style={{ fontSize: 12, margin: 0 }}>
          Сообщение уйдёт только родителям, которые подключили Telegram (через ссылку в карточке ученика).
        </p>
      </form>
    </div>
  );
}
