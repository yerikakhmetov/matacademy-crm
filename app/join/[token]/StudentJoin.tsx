"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { Icon } from "@/components/Icon";
import { t, type Locale } from "@/lib/i18n";

// Регистрация/вход ученика в кабинет через Telegram: открывает бота и логинит,
// как только бот подтвердит вход.
//
// Это именно ссылка, а не кнопка с window.open: на телефоне открытие нового окна
// из обработчика считается всплывающим и молча блокируется — ученик нажимал, и
// ничего не происходило. По настоящей ссылке браузер переходит всегда.
export function StudentJoin({ joinToken, botUsername, locale }: { joinToken: string; botUsername: string | null; locale: Locale }) {
  const [token, setToken] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Код разовый и создаётся уже в браузере: на сервере он был бы другим,
  // и разметка не совпала бы при гидратации.
  useEffect(() => {
    setToken(crypto.randomUUID().replace(/-/g, "").slice(0, 16));
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  if (!botUsername) {
    return <div className="chip c-bad" style={{ fontSize: 12 }}><span className="d" />{t(locale, "join.botNotConfigured")}</div>;
  }

  const url = token ? `https://t.me/${botUsername}?start=slogin_${joinToken}_${token}` : null;

  const beginWaiting = () => {
    if (!token || waiting) return;
    setError(null);
    setWaiting(true);
    const started = Date.now();
    timer.current = setInterval(async () => {
      if (Date.now() - started > 5 * 60 * 1000) {
        if (timer.current) clearInterval(timer.current);
        setWaiting(false);
        setError(t(locale, "join.timeout"));
        return;
      }
      try {
        const res = await fetch(`/api/telegram/login-status?token=${token}`);
        const data = await res.json();
        if (data.ready) {
          if (timer.current) clearInterval(timer.current);
          await signIn("telegram", { token, callbackUrl: "/cabinet" });
        }
      } catch {
        /* повторим на следующем тике */
      }
    }, 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <a
        href={url ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        onClick={beginWaiting}
        aria-disabled={!url}
        className="btn"
        style={{
          background: "#229ED9",
          color: "#fff",
          boxShadow: "none",
          width: "100%",
          justifyContent: "center",
          padding: 12,
          fontSize: 15,
          textDecoration: "none",
          opacity: url ? 1 : 0.6,
          pointerEvents: url ? "auto" : "none",
        }}
      >
        <Icon name="phone" size={18} />
        {waiting ? t(locale, "join.confirming") : t(locale, "join.loginTelegram")}
      </a>

      {waiting && (
        <span className="mut" style={{ fontSize: 12, textAlign: "center" }}>
          {t(locale, "join.openBotHint")}
        </span>
      )}

      {/* Если приложение не открылось (Telegram не установлен, ссылку зажевал
          встроенный браузер) — адрес видно и его можно скопировать руками. */}
      {url && (
        <details style={{ width: "100%" }}>
          <summary className="mut" style={{ fontSize: 11.5, cursor: "pointer" }}>
            {t(locale, "join.notOpening")}
          </summary>
          <div
            style={{
              fontSize: 11,
              wordBreak: "break-all",
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "8px 10px",
              marginTop: 8,
              color: "var(--ink-2)",
            }}
          >
            {url}
          </div>
        </details>
      )}

      {error && <span className="chip c-bad" style={{ fontSize: 11.5 }}><span className="d" />{error}</span>}
    </div>
  );
}
