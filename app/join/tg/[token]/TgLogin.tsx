"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { Icon } from "@/components/Icon";
import { t, type Locale } from "@/lib/i18n";

// Вход по одноразовому токену из кнопки в Telegram. Пробуем войти сразу,
// но оставляем и кнопку: во встроенном браузере Telegram автозапуск иногда
// не срабатывает, и ученик снова остался бы ни с чем.
export function TgLogin({ token, locale }: { token: string; locale: Locale }) {
  const [failed, setFailed] = useState(false);

  const go = async () => {
    setFailed(false);
    const res = await signIn("telegram", { token, redirect: false });
    if (res?.error) setFailed(true);
    else window.location.href = "/cabinet";
  };

  useEffect(() => {
    void go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <button
        className="btn"
        type="button"
        onClick={go}
        style={{ width: "100%", justifyContent: "center", padding: 12, fontSize: 15 }}
      >
        <Icon name="check" size={18} />
        {t(locale, "join.enterCabinet")}
      </button>
      {failed && (
        <span className="chip c-bad" style={{ fontSize: 11.5 }}>
          <span className="d" />
          {t(locale, "join.tgExpired")}
        </span>
      )}
    </div>
  );
}
