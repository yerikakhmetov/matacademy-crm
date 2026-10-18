"use client";

import { useRouter } from "next/navigation";

// Фильтры успеваемости: группа, месяц («all» — за всё время) и тип оценки («all» — любые).
export function GroupSelect({
  groups,
  groupId,
  months,
  month,
  types,
  type,
}: {
  groups: { id: string; name: string }[];
  groupId: string;
  months: { key: string; label: string }[];
  month: string;
  types: { key: string; label: string }[];
  type: string;
}) {
  const router = useRouter();
  const go = (next: Partial<{ group: string; month: string; type: string }>) => {
    const q = new URLSearchParams({ group: groupId, month, type, ...next });
    router.push(`/grades?${q}`);
  };
  return (
    <>
      <select className="filter" value={groupId} onChange={(e) => go({ group: e.target.value })} style={{ minWidth: 200 }}>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      <select className="filter" value={month} onChange={(e) => go({ month: e.target.value })} aria-label="Месяц">
        {months.map((m) => (
          <option key={m.key} value={m.key}>
            {m.label}
          </option>
        ))}
      </select>
      <select className="filter" value={type} onChange={(e) => go({ type: e.target.value })} aria-label="Тип оценки">
        {types.map((t) => (
          <option key={t.key} value={t.key}>
            {t.label}
          </option>
        ))}
      </select>
    </>
  );
}
