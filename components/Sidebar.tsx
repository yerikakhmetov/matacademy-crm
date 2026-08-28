"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { logout } from "@/app/actions/auth";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { initials } from "@/lib/format";

const NAV = [
  { section: "Обзор" },
  { href: "/dashboard", icon: "dashboard", label: "Дашборд" },
  { section: "Учебный процесс" },
  { href: "/students", icon: "students", label: "Ученики", badgeKey: "students" },
  { href: "/groups", icon: "groups", label: "Группы" },
  { href: "/schedule", icon: "schedule", label: "Расписание" },
  { href: "/journal", icon: "check", label: "Журнал" },
  { href: "/teachers", icon: "teachers", label: "Учителя" },
  { section: "Продажи и деньги" },
  { href: "/leads", icon: "leads", label: "Лиды", badgeKey: "leads" },
  { href: "/payments", icon: "payments", label: "Оплаты" },
] as const;

export function Sidebar({
  user,
  counts,
}: {
  user: { name?: string | null; role?: string };
  counts: { students: number; leads: number };
}) {
  const pathname = usePathname();
  return (
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

      {NAV.map((item, i) =>
        "section" in item ? (
          <div className="nav-label" key={"s" + i}>
            {item.section}
          </div>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${pathname.startsWith(item.href) ? "active" : ""}`}
          >
            <Icon name={item.icon} />
            {item.label}
            {"badgeKey" in item && item.badgeKey && counts[item.badgeKey as "students" | "leads"] > 0 && (
              <span className="badge">{counts[item.badgeKey as "students" | "leads"]}</span>
            )}
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
  );
}
