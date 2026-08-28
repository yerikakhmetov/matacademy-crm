"use client";

import { useRouter } from "next/navigation";

type Opt = { id: string; name: string };

export function JournalFilters({
  groups,
  months,
  groupId,
  month,
}: {
  groups: Opt[];
  months: Opt[];
  groupId: string;
  month: string;
}) {
  const router = useRouter();
  const go = (g: string, m: string) => router.push(`/journal?group=${g}&month=${m}`);

  return (
    <div className="toolbar">
      <select
        className="filter"
        value={groupId}
        onChange={(e) => go(e.target.value, month)}
        style={{ minWidth: 200 }}
      >
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      <select className="filter" value={month} onChange={(e) => go(groupId, e.target.value)}>
        {months.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  );
}
