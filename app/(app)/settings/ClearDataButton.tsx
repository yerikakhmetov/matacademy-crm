"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearAllData } from "@/app/actions/data";

export function ClearDataButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (done) {
    return (
      <div className="chip c-ok" style={{ padding: "8px 14px" }}>
        <span className="d" />
        Готово — все данные очищены. Логины и настройки сохранены.
      </div>
    );
  }

  if (!open) {
    return (
      <button className="btn danger" type="button" onClick={() => setOpen(true)}>
        Очистить все данные
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 460 }}>
      <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
        Будут <b>безвозвратно</b> удалены все ученики, группы, учителя, лиды, оплаты, абонементы,
        оценки и посещаемость. Логины и настройки школы <b>сохранятся</b>.
        <br />
        Для подтверждения введите слово <b>ОЧИСТИТЬ</b>:
      </div>
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        placeholder="ОЧИСТИТЬ"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 9,
          padding: "10px 12px",
          fontSize: 14,
          color: "var(--ink)",
          maxWidth: 240,
        }}
      />
      {error && <div className="err" style={{ margin: 0 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          className="btn ghost"
          type="button"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setText("");
          }}
        >
          Отмена
        </button>
        <button
          className="btn danger"
          type="button"
          disabled={pending || text !== "ОЧИСТИТЬ"}
          onClick={() =>
            start(async () => {
              try {
                await clearAllData(text);
                setDone(true);
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Ошибка");
              }
            })
          }
        >
          {pending ? "Очищаем…" : "Удалить всё безвозвратно"}
        </button>
      </div>
    </div>
  );
}
