"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

const TITLES: Record<string, string> = {
  "/dashboard": "Дашборд",
  "/reports": "Отчёты и аналитика",
  "/students": "Ученики",
  "/groups": "Группы",
  "/schedule": "Расписание",
  "/journal": "Журнал посещаемости",
  "/teachers": "Учителя",
  "/leads": "Лиды и продажи",
  "/payments": "Оплаты и абонементы",
};

export function Topbar() {
  const pathname = usePathname();
  const key = Object.keys(TITLES).find((k) => pathname.startsWith(k));
  const title = key ? TITLES[key] : "МатАкадемия";
  const [dark, setDark] = useState(false);

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
      <div className="crumb">
        <b>{title}</b>
      </div>
      <div className="search">
        <Icon name="search" size={16} />
        <input placeholder="Поиск ученика, группы, телефона…" />
      </div>
      <div className="top-actions">
        <div className="filter">
          <Icon name="pin" size={15} />
          Филиал: Абая
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
