"use client";

import { useRouter } from "next/navigation";

export function MonthSelect({ months, month }: { months: { id: string; name: string }[]; month: string }) {
  const router = useRouter();
  return (
    <select className="filter" value={month} onChange={(e) => router.push(`/payroll?month=${e.target.value}`)}>
      {months.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
