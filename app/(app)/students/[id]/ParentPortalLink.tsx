"use client";

import { useEffect, useState, useTransition } from "react";
import { regeneratePortalToken } from "@/app/actions/data";
import { Icon } from "@/components/Icon";

export function ParentPortalLink({ studentId, token }: { studentId: string; token: string }) {
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const [url, setUrl] = useState(`/p/${token}`);

  // Полный адрес доступен только на клиенте
  useEffect(() => {
    setUrl(`${window.location.origin}/p/${token}`);
  }, [token]);

  const regenerate = () => {
    if (!confirm("Старая ссылка родителя перестанет работать. Перевыпустить?")) return;
    start(() => regeneratePortalToken(studentId));
  };

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
        Постоянная ссылка для родителя — успеваемость, посещаемость, оплаты и абонемент. Вход не нужен.
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
        Ссылка открывает данные ученика без входа. Если она попала не тем — перевыпустите.
      </p>
    </div>
  );
}
