"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { logout } from "@/app/actions/auth";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { initials } from "@/lib/format";

type Item = { section: string; adminOnly?: boolean } | { href: string; icon: string; label: string; badgeKey?: "students" | "leads"; adminOnly?: boolean };

const NAV_FULL: Item[] = [
  { section: "Обзор" },
  { href: "/dashboard", icon: "dashboard", label: "Дашборд" },
  { href: "/reports", icon: "chart", label: "Отчёты" },
  { href: "/audit", icon: "clock", label: "История", adminOnly: true },
  { section: "Учебный процесс" },
  { href: "/students", icon: "students", label: "Ученики", badgeKey: "students" },
  { href: "/groups", icon: "groups", label: "Группы" },
  { href: "/schedule", icon: "schedule", label: "Расписание" },
  { href: "/journal", icon: "check", label: "Журнал" },
  { href: "/grades", icon: "chart", label: "Успеваемость" },
  { href: "/teachers", icon: "teachers", label: "Учителя" },
  { section: "Продажи и деньги" },
  { href: "/leads", icon: "leads", label: "Лиды", badgeKey: "leads" },
  { href: "/payments", icon: "payments", label: "Оплаты" },
  { href: "/reminders", icon: "bell", label: "Напоминания" },
  { href: "/payroll", icon: "money", label: "Зарплата" },
  { section: "Система", adminOnly: true },
  { href: "/settings", icon: "pin", label: "Настройки", adminOnly: true },
];

// Для учителя — только его разделы
const NAV_TEACHER: Item[] = [
  { section: "Мой кабинет" },
  { href: "/dashboard", icon: "dashboard", label: "Мои занятия" },
  { href: "/groups", icon: "groups", label: "Мои группы" },
  { href: "/schedule", icon: "schedule", label: "Расписание" },
  { href: "/journal", icon: "check", label: "Журнал" },
  { href: "/grades", icon: "chart", label: "Успеваемость" },
];

export function Sidebar({
  user,
  counts,
}: {
  user: { name?: string | null; role?: string };
  counts: { students: number; leads: number };
}) {
  const pathname = usePathname();
  const nav = (user.role === "TEACHER" ? NAV_TEACHER : NAV_FULL).filter(
    (i) => !("adminOnly" in i && i.adminOnly) || user.role === "ADMIN"
  );
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
