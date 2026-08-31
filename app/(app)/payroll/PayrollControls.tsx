"use client";

import { useRouter } from "next/navigation";

export function MonthSelect({ months, month, path = "/payroll" }: { months: { id: string; name: string }[]; month: string; path?: string }) {
  const router = useRouter();
  return (
    <select className="filter" value={month} onChange={(e) => router.push(`${path}?month=${e.target.value}`)}>
      {months.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
