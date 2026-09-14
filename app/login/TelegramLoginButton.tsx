"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { Icon } from "@/components/Icon";

// Вход через бота: открывает бота с одноразовым токеном и ждёт подтверждения.
// Работает и для преподавателя, и для ученика, чей кабинет уже привязан к Telegram.
export function TelegramLoginButton({ botUsername }: { botUsername: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Код создаётся в браузере: на сервере он был бы другим и разметка не совпала бы.
  useEffect(() => {
    setToken(crypto.randomUUID().replace(/-/g, ""));
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  const start = () => {
    if (!token || waiting) return;
    setError(null);
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
      <span className="mut" style={{ fontSize: 12 }}>Преподаватели и ученики входят через Telegram</span>
      {/* Ссылка, а не window.open: на телефоне новое окно из обработчика
          считается всплывающим и молча блокируется. */}
      <a
        href={token ? `https://t.me/${botUsername}?start=login_${token}` : "#"}
        target="_blank"
        rel="noopener noreferrer"
        onClick={start}
        className="btn"
        style={{
          background: "#229ED9",
          color: "#fff",
          boxShadow: "none",
          width: "100%",
          justifyContent: "center",
          textDecoration: "none",
          opacity: token ? 1 : 0.6,
          pointerEvents: token ? "auto" : "none",
        }}
      >
        <Icon name="phone" size={16} />
        {waiting ? "Подтвердите в Telegram…" : "Войти через Telegram"}
      </a>
      {waiting && (
        <span className="mut" style={{ fontSize: 11.5, textAlign: "center" }}>
          Откройте бота, нажмите «Старт» — вход произойдёт автоматически.
        </span>
      )}
      {error && <span className="chip c-bad" style={{ fontSize: 11.5 }}><span className="d" />{error}</span>}
    </div>
  );
}
