"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { Icon } from "@/components/Icon";
import { t, type Locale } from "@/lib/i18n";

// Регистрация/вход ученика в кабинет через Telegram (один тап): привязывает аккаунт и логинит.
export function StudentJoin({ joinToken, botUsername, locale }: { joinToken: string; botUsername: string | null; locale: Locale }) {
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  if (!botUsername) {
    return <div className="chip c-bad" style={{ fontSize: 12 }}><span className="d" />{t(locale, "join.botNotConfigured")}</div>;
  }

  const start = () => {
    setError(null);
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    window.open(`https://t.me/${botUsername}?start=slogin_${joinToken}_${token}`, "_blank");
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
      <button
        type="button"
        onClick={start}
        disabled={waiting}
        className="btn"
        style={{ background: "#229ED9", boxShadow: "none", width: "100%", justifyContent: "center", padding: 12, fontSize: 15 }}
      >
        <Icon name="phone" size={18} />
        {waiting ? t(locale, "join.confirming") : t(locale, "join.loginTelegram")}
      </button>
      {waiting && (
        <span className="mut" style={{ fontSize: 12, textAlign: "center" }}>
          {t(locale, "join.openBotHint")}
        </span>
      )}
      {error && <span className="chip c-bad" style={{ fontSize: 11.5 }}><span className="d" />{error}</span>}
    </div>
  );
}
