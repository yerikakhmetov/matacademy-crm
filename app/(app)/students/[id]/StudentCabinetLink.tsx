"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

export function StudentCabinetLink({ id, linked }: { id: string; linked: boolean }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState(`/join/${id}`);

  useEffect(() => {
    setUrl(`${window.location.origin}/join/${id}`);
  }, [id]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p className="mut" style={{ fontSize: 12.5, margin: 0 }}>
        Персональная ссылка для входа ученика в личный кабинет. Регистрация и вход — только через Telegram.
        {linked ? " Аккаунт уже привязан." : " Аккаунт ещё не привязан."}
      </p>
      <div style={{ fontSize: 12.5, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", wordBreak: "break-all", color: "var(--ink-2)" }}>
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
      </div>
    </div>
  );
}
