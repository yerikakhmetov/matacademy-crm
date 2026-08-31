"use client";

import { useRouter } from "next/navigation";

export function AuditFilters({
  users,
  entities,
  action,
  user,
  entity,
}: {
  users: string[];
  entities: string[];
  action: string;
  user: string;
  entity: string;
}) {
  const router = useRouter();
  const go = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    const next = { action, user, entity, ...patch };
    if (next.action && next.action !== "all") p.set("action", next.action);
    if (next.user && next.user !== "all") p.set("user", next.user);
    if (next.entity && next.entity !== "all") p.set("entity", next.entity);
    router.push(`/audit${p.toString() ? "?" + p.toString() : ""}`);
  };

  const ACTIONS = [
    { key: "all", label: "Все" },
    { key: "CREATE", label: "Создано" },
    { key: "UPDATE", label: "Изменено" },
    { key: "DELETE", label: "Удалено" },
  ];

  return (
    <div className="toolbar">
      <div className="seg">
        {ACTIONS.map((a) => (
          <button key={a.key} className={action === a.key ? "on" : ""} onClick={() => go({ action: a.key })}>
            {a.label}
          </button>
        ))}
      </div>
      <select className="filter" value={user} onChange={(e) => go({ user: e.target.value })}>
        <option value="all">Все пользователи</option>
        {users.map((u) => (
          <option key={u} value={u}>{u}</option>
        ))}
      </select>
      <select className="filter" value={entity} onChange={(e) => go({ entity: e.target.value })}>
        <option value="all">Все объекты</option>
        {entities.map((en) => (
          <option key={en} value={en}>{en}</option>
        ))}
      </select>
    </div>
  );
}
