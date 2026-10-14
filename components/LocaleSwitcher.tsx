"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/app/actions/locale";
import { LOCALES, LOCALE_LABEL, type Locale } from "@/lib/i18n";

// Короткие подписи для узкого экрана: полное название не помещается в шапку телефона
const SHORT: Record<Locale, string> = { ru: "RU", kk: "KZ" };

export function LocaleSwitcher({ current, path }: { current: Locale; path: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="locale-switch" style={{ display: "inline-flex", gap: 2, background: "var(--surface-2)", borderRadius: 8, padding: 2, flex: "none" }}>
      {LOCALES.map((l) => {
        const active = l === current;
        return (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={active}
            disabled={pending || active}
            onClick={() =>
              start(async () => {
                await setLocale(l, path);
                router.refresh();
              })
            }
            style={{
              border: "none",
              borderRadius: 6,
              padding: "4px 9px",
              fontSize: 12,
              fontWeight: 700,
              cursor: active ? "default" : "pointer",
              background: active ? "var(--surface)" : "transparent",
              color: active ? "var(--ink)" : "var(--ink-3)",
            }}
          >
            <span className="ls-full">{LOCALE_LABEL[l]}</span>
            <span className="ls-short" aria-hidden="true">{SHORT[l]}</span>
          </button>
        );
      })}
    </div>
  );
}
