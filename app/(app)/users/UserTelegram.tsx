"use client";

import { useEffect, useState, useTransition } from "react";
import { issueTelegramBind, unbindTelegram } from "@/app/actions/data";
import { Icon } from "@/components/Icon";

// Привязка Telegram к учётной записи: администратор выдаёт одноразовый код
// и передаёт ссылку владельцу аккаунта. Ссылка — это фактически вход,
// поэтому она одноразовая и живёт полчаса.
export function UserTelegram({
  userId,
  linked,
  token,
  botUsername,
}: {
  userId: string;
  linked: boolean;
  token: string | null;
  botUsername: string | null;
}) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(token && botUsername ? `https://t.me/${botUsername}?start=tgbind_${token}` : null);
  }, [token, botUsername]);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  if (!botUsername) {
    return <span className="mut" style={{ fontSize: 12 }}>Бот не настроен</span>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
      <span className={`chip ${linked ? "c-ok" : "c-mut"}`} style={{ fontSize: 10.5 }}>
        <span className="d" />
        {linked ? "Telegram привязан" : "Не привязан"}
      </span>

      {url && (
        <>
          <div
            style={{
              fontSize: 11.5,
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "6px 8px",
              wordBreak: "break-all",
              color: "var(--ink-2)",
              maxWidth: 260,
            }}
          >
            {url}
          </div>
          <span className="mut" style={{ fontSize: 11 }}>Код одноразовый, действует 30 минут</span>
        </>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {url && (
          <button className="btn ghost" type="button" onClick={copy} style={{ padding: "4px 9px", fontSize: 12 }}>
            <Icon name={copied ? "check" : "export"} size={13} />
            {copied ? "Скопировано" : "Копировать"}
          </button>
        )}
        <button
          className="btn ghost"
          type="button"
          disabled={pending}
          style={{ padding: "4px 9px", fontSize: 12 }}
          onClick={() => start(() => issueTelegramBind(userId))}
        >
          {pending ? "…" : url || linked ? "Новый код" : "Привязать Telegram"}
        </button>
        {linked && (
          <button
            className="btn ghost"
            type="button"
            disabled={pending}
            style={{ padding: "4px 9px", fontSize: 12, color: "var(--bad)" }}
            onClick={() => {
              if (!confirm("Вход через Telegram для этой учётной записи перестанет работать. Отвязать?")) return;
              start(() => unbindTelegram(userId));
            }}
          >
            Отвязать
          </button>
        )}
      </div>
    </div>
  );
}
