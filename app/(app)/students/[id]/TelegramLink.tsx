"use client";

import { useState, useTransition } from "react";
import { unlinkTelegram } from "@/app/actions/data";
import { Icon } from "@/components/Icon";

export function TelegramLink({
  studentId,
  linked,
  botUsername,
}: {
  studentId: string;
  linked: boolean;
  botUsername: string | null;
}) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const invite = botUsername ? `https://t.me/${botUsername}?start=${studentId}` : null;

  if (linked) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span className="chip c-ok">
          <span className="d" />
          Родитель подписан на уведомления
        </span>
        <button className="btn ghost" type="button" disabled={pending} onClick={() => start(() => unlinkTelegram(studentId))} style={{ padding: "6px 11px", fontSize: 12.5 }}>
          {pending ? "…" : "Отвязать"}
        </button>
      </div>
    );
  }

  if (!invite) {
    return <p className="mut" style={{ fontSize: 12.5, margin: 0 }}>Укажите TELEGRAM_BOT_USERNAME в настройках, чтобы приглашать родителей.</p>;
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p className="mut" style={{ fontSize: 12.5, margin: 0 }}>
        Отправьте родителю ссылку — он нажмёт «Старт» в боте и начнёт получать напоминания.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a className="btn" href={invite} target="_blank" rel="noopener noreferrer" style={{ padding: "7px 13px", fontSize: 13, background: "#229ED9", boxShadow: "none" }}>
          <Icon name="phone" size={15} />
          Открыть в Telegram
        </a>
        <button className="btn ghost" type="button" onClick={copy} style={{ padding: "7px 13px", fontSize: 13 }}>
          <Icon name={copied ? "check" : "edit"} size={14} />
          {copied ? "Скопировано" : "Копировать ссылку"}
        </button>
      </div>
    </div>
  );
}
