"use client";

import { useTransition } from "react";
import { lockPayrollMonth, unlockPayrollMonth } from "@/app/actions/data";

export function PayrollLockButton({ year, month0, locked }: { year: number; month0: number; locked: boolean }) {
  const [pending, start] = useTransition();
  if (locked) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="chip c-ok"><span className="d" />Зафиксирован</span>
        <button className="btn ghost" type="button" disabled={pending} onClick={() => start(() => unlockPayrollMonth(year, month0))}>
          {pending ? "…" : "Снять фиксацию"}
        </button>
      </div>
    );
  }
  return (
    <button className="btn" type="button" disabled={pending} onClick={() => start(() => lockPayrollMonth(year, month0))}>
      {pending ? "Фиксируем…" : "Зафиксировать месяц"}
    </button>
  );
}
