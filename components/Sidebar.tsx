"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { logout } from "@/app/actions/auth";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { initials } from "@/lib/format";

type Item = { section: string } | { href: string; icon: string; label: string; badgeKey?: "students" | "leads" };

const NAV_FULL: Item[] = [
  { section: "Обзор" },
  { href: "/dashboard", icon: "dashboard", label: "Дашборд" },
  { href: "/reports", icon: "chart", label: "Отчёты" },
  { section: "Учебный процесс" },
  { href: "/students", icon: "students", label: "Ученики", badgeKey: "students" },
  { href: "/groups", icon: "groups", label: "Группы" },
  { href: "/schedule", icon: "schedule", label: "Расписание" },
  { href: "/journal", icon: "check", label: "Журнал" },
  { href: "/teachers", icon: "teachers", label: "Учителя" },
  { section: "Продажи и деньги" },
  { href: "/leads", icon: "leads", label: "Лиды", badgeKey: "leads" },
  { href: "/payments", icon: "payments", label: "Оплаты" },
  { href: "/reminders", icon: "bell", label: "Напоминания" },
];

// Для учителя — только его разделы
const NAV_TEACHER: Item[] = [
  { section: "Мой кабинет" },
  { href: "/dashboard", icon: "dashboard", label: "Мои занятия" },
  { href: "/groups", icon: "groups", label: "Мои группы" },
  { href: "/schedule", icon: "schedule", label: "Расписание" },
  { href: "/journal", icon: "check", label: "Журнал" },
];

export function Sidebar({
  user,
  counts,
}: {
  user: { name?: string | null; role?: string };
  counts: { students: number; leads: number };
}) {
  const pathname = usePathname();
  const nav = user.role === "TEACHER" ? NAV_TEACHER : NAV_FULL;
  const closeNav = () => document.documentElement.classList.remove("nav-open");

  return (
    <>
    <div className="nav-scrim" onClick={closeNav} />
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">
          <Icon name="book" size={22} style={{ color: "#fff" }} />
        </div>
        <div>
          <b>МатАкадемия</b>
          <span>Офлайн-школа · CRM</span>
        </div>
      </div>

      {nav.map((item, i) =>
        "section" in item ? (
          <div className="nav-label" key={"s" + i}>
            {item.section}
          </div>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            onClick={closeNav}
            className={`nav-item ${pathname.startsWith(item.href) ? "active" : ""}`}
          >
            <Icon name={item.icon} />
            {item.label}
            {item.badgeKey && counts[item.badgeKey] > 0 && <span className="badge">{counts[item.badgeKey]}</span>}
          </Link>
        )
      )}

      <div className="side-foot">
        <div className="av">{initials(user.name ?? "?")}</div>
        <div>
          <div className="nm">{user.name}</div>
          <div className="rl">{ROLE_LABEL[(user.role as Role) ?? "MANAGER"] ?? "Пользователь"}</div>
        </div>
        <form action={logout}>
          <button className="logout" title="Выйти" type="submit">
            <Icon name="logout" size={16} />
          </button>
        </form>
      </div>
    </aside>
    </>
  );
}
