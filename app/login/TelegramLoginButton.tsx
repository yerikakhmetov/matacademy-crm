"use client";

import { useEffect, useRef } from "react";
import { signIn } from "next-auth/react";

// Кнопка «Войти через Telegram» (виджет Telegram Login).
export function TelegramLoginButton({ botUsername }: { botUsername: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (window as unknown as { onTelegramAuth?: (u: Record<string, unknown>) => void }).onTelegramAuth = (user) => {
      const creds: Record<string, string> = {};
      for (const [k, v] of Object.entries(user)) if (v != null) creds[k] = String(v);
      signIn("telegram", { ...creds, callbackUrl: "/dashboard" });
    };
    const container = ref.current;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.setAttribute("data-telegram-login", botUsername);
    s.setAttribute("data-size", "large");
    s.setAttribute("data-radius", "9");
    s.setAttribute("data-onauth", "onTelegramAuth(user)");
    s.setAttribute("data-request-access", "write");
    container?.appendChild(s);
    return () => {
      if (container) container.innerHTML = "";
    };
  }, [botUsername]);

  return (
    <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--line-2)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <span className="mut" style={{ fontSize: 12 }}>Преподаватели входят через Telegram</span>
      <div ref={ref} />
    </div>
  );
}
