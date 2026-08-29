"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { Icon } from "@/components/Icon";

// Вход преподавателя через бота: открывает бота с одноразовым токеном и ждёт подтверждения.
export function TelegramLoginButton({ botUsername }: { botUsername: string }) {
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const start = () => {
    setError(null);
    const token = crypto.randomUUID().replace(/-/g, "");
    window.open(`https://t.me/${botUsername}?start=login_${token}`, "_blank");
    setWaiting(true);

    const started = Date.now();
    timer.current = setInterval(async () => {
      if (Date.now() - started > 5 * 60 * 1000) {
        if (timer.current) clearInterval(timer.current);
        setWaiting(false);
        setError("Время ожидания истекло. Попробуйте снова.");
        return;
      }
      try {
        const res = await fetch(`/api/telegram/login-status?token=${token}`);
        const data = await res.json();
        if (data.ready) {
          if (timer.current) clearInterval(timer.current);
          await signIn("telegram", { token, callbackUrl: "/dashboard" });
        }
      } catch {
        /* повторим на следующем тике */
      }
    }, 2000);
  };

  return (
    <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--line-2)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <span className="mut" style={{ fontSize: 12 }}>Преподаватели входят через Telegram</span>
      <button
        type="button"
        onClick={start}
        disabled={waiting}
        className="btn"
        style={{ background: "#229ED9", boxShadow: "none", width: "100%", justifyContent: "center" }}
      >
        <Icon name="phone" size={16} />
        {waiting ? "Подтвердите в Telegram…" : "Войти через Telegram"}
      </button>
      {waiting && (
        <span className="mut" style={{ fontSize: 11.5, textAlign: "center" }}>
          Откройте бота, нажмите «Старт» — вход произойдёт автоматически.
        </span>
      )}
      {error && <span className="chip c-bad" style={{ fontSize: 11.5 }}><span className="d" />{error}</span>}
    </div>
  );
}
