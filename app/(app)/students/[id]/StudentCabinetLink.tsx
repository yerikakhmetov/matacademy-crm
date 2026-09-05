"use client";

import { useEffect, useState, useTransition } from "react";
import { regenerateJoinToken } from "@/app/actions/data";
import { Icon } from "@/components/Icon";

export function StudentCabinetLink({
  studentId,
  token,
  linked,
  claimed,
}: {
  studentId: string;
  token: string;
  linked: boolean;
  claimed: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState(`/join/${token}`);
  const [pending, start] = useTransition();

  useEffect(() => {
    setUrl(`${window.location.origin}/join/${token}`);
  }, [token]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const regenerate = () => {
    if (!confirm("Старая ссылка перестанет работать, а привязка к Telegram сбросится. Перевыпустить?")) return;
    start(() => regenerateJoinToken(studentId));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p className="mut" style={{ fontSize: 12.5, margin: 0 }}>
        Персональная ссылка для входа ученика в личный кабинет. Регистрация и вход — только через Telegram.
        {linked ? " Аккаунт уже привязан." : " Аккаунт ещё не привязан."}
        {claimed ? " Кабинет закреплён за Telegram ученика." : ""}
      </p>
      <div
        style={{
          fontSize: 12.5,
          background: "var(--surface-2)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: "8px 10px",
          wordBreak: "break-all",
          color: "var(--ink-2)",
        }}
      >
        {url}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn" type="button" onClick={copy} style={{ padding: "7px 13px", fontSize: 13 }}>
          <Icon name={copied ? "check" : "export"} size={14} />
          {copied ? "Скопировано" : "Копировать ссылку"}
        </button>
        <a className="btn ghost" href={url} target="_blank" rel="noopener noreferrer" style={{ padding: "7px 13px", fontSize: 13 }}>
          Открыть
        </a>
        <button
          className="btn ghost"
          type="button"
          onClick={regenerate}
          disabled={pending}
          style={{ padding: "7px 13px", fontSize: 13, color: "var(--bad)" }}
        >
          {pending ? "Перевыпускаем…" : "Перевыпустить"}
        </button>
      </div>
      <p className="mut" style={{ fontSize: 11.5, margin: 0 }}>
        Ссылка действует как ключ от кабинета. Если она попала не тем — перевыпустите: старая сразу перестанет работать.
      </p>
    </div>
  );
}
