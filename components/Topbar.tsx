"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

const TITLES: Record<string, string> = {
  "/dashboard": "Дашборд",
  "/reports": "Отчёты и аналитика",
  "/audit": "История изменений",
  "/students": "Ученики",
  "/groups": "Группы",
  "/schedule": "Расписание",
  "/journal": "Журнал посещаемости",
  "/grades": "Успеваемость",
  "/teachers": "Учителя",
  "/leads": "Лиды и продажи",
  "/payments": "Оплаты и абонементы",
  "/reminders": "Напоминания об оплате",
  "/settings": "Настройки школы",
};

export function Topbar({ branch }: { branch?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const key = Object.keys(TITLES).find((k) => pathname.startsWith(k));
  const title = pathname.startsWith("/search") ? "Поиск" : key ? TITLES[key] : "МатАкадемия";
  const [dark, setDark] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (pathname === "/search") setQ(searchParams.get("q") ?? "");
  }, [pathname, searchParams]);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved) {
      document.documentElement.setAttribute("data-theme", saved);
      setDark(saved === "dark");
    } else {
      setDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
  }, []);

  function toggle() {
    const cur = document.documentElement.getAttribute("data-theme") || (dark ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    setDark(next === "dark");
  }

  return (
    <header className="topbar">
      <button
        className="burger"
        aria-label="Меню"
        onClick={() => document.documentElement.classList.toggle("nav-open")}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div className="crumb">
        <b>{title}</b>
      </div>
      <form
        className="search"
        onSubmit={(e) => {
          e.preventDefault();
          const term = (new FormData(e.currentTarget).get("q") as string | null)?.trim() ?? "";
          if (term) router.push(`/search?q=${encodeURIComponent(term)}`);
        }}
      >
        <Icon name="search" size={16} />
        <input
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск ученика, группы, телефона…"
          aria-label="Поиск"
        />
      </form>
      <div className="top-actions">
        <div className="filter">
          <Icon name="pin" size={15} />
          Филиал: {branch || "Абая"}
        </div>
        <button className="icon-btn" onClick={toggle} title="Тема">
          <Icon name="moon" />
        </button>
        <button className="icon-btn" title="Уведомления">
          <span className="dot" />
          <Icon name="bell" />
        </button>
      </div>
    </header>
  );
}
