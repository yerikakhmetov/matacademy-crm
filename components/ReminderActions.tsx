"use client";

import { useState } from "react";
import { Icon } from "./Icon";

// Кнопки «WhatsApp» и «Копировать текст» для напоминания родителю.
export function ReminderActions({ phone, message }: { phone: string | null; message: string }) {
  const [copied, setCopied] = useState(false);

  const digits = (phone ?? "").replace(/\D/g, "");
  const hasPhone = digits.length >= 10;
  const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // буфер недоступен — молча игнорируем
    }
  };

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
      <button className="btn ghost" type="button" onClick={copy} style={{ padding: "6px 11px", fontSize: 12.5 }} title="Скопировать текст напоминания">
        <Icon name={copied ? "check" : "edit"} size={14} />
        {copied ? "Скопировано" : "Текст"}
      </button>
      {hasPhone ? (
        <a
          className="btn"
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: "6px 11px", fontSize: 12.5, background: "#25D366", boxShadow: "none" }}
          title="Открыть WhatsApp с готовым сообщением"
        >
          <Icon name="phone" size={14} />
          WhatsApp
        </a>
      ) : (
        <span className="chip c-mut" title="У ученика не указан телефон родителя">
          <span className="d" />
          нет телефона
        </span>
      )}
    </div>
  );
}
