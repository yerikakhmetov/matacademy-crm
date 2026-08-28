"use client";

import { useRouter } from "next/navigation";

export function GroupSelect({ groups, groupId }: { groups: { id: string; name: string }[]; groupId: string }) {
  const router = useRouter();
  return (
    <select className="filter" value={groupId} onChange={(e) => router.push(`/grades?group=${e.target.value}`)} style={{ minWidth: 220 }}>
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </select>
  );
}
