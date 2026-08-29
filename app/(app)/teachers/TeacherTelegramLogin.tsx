"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

export function TeacherTelegramLogin({
  teacherId,
  linked,
  botUsername,
}: {
  teacherId: string;
  linked: boolean;
  botUsername: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (botUsername) setUrl(`https://t.me/${botUsername}?start=teacherlogin_${teacherId}`);
  }, [botUsername, teacherId]);

  if (!botUsername) {
    return <p className="mut" style={{ fontSize: 12, margin: 0 }}>Укажите TELEGRAM_BOT_USERNAME в настройках Vercel.</p>;
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>Вход по Telegram</span>
        <span className={`chip ${linked ? "c-ok" : "c-mut"}`} style={{ fontSize: 11 }}>
          <span className="d" />
          {linked ? "Привязан" : "Не привязан"}
        </span>
      </div>
      <p className="mut" style={{ fontSize: 12, margin: 0 }}>
        Отправьте преподавателю ссылку — он нажмёт «Старт», после чего сможет входить кнопкой «Войти через Telegram».
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a className="btn" href={url} target="_blank" rel="noopener noreferrer" style={{ padding: "6px 12px", fontSize: 12.5, background: "#229ED9", boxShadow: "none" }}>
          <Icon name="phone" size={14} />
          Открыть в Telegram
        </a>
        <button className="btn ghost" type="button" onClick={copy} style={{ padding: "6px 12px", fontSize: 12.5 }}>
          <Icon name={copied ? "check" : "edit"} size={14} />
          {copied ? "Скопировано" : "Копировать ссылку"}
        </button>
      </div>
    </div>
  );
}
