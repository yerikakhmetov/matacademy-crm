"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

// Переключатель тёмной темы. Выбор запоминается в localStorage — так же,
// как в панели сотрудников, чтобы поведение было одинаковым везде.
export function ThemeToggle({ title }: { title: string }) {
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
    <button className="icon-btn" type="button" onClick={toggle} title={title} aria-label={title}>
      <Icon name="moon" size={16} />
    </button>
  );
}
