"use client";

import { useState } from "react";
import { MAX_PERIOD_MONTHS, periodKey, periodLabel, periodOptions, parsePeriodMonth } from "@/lib/period";

// «За какой месяц» при приёме оплаты и выставлении счёта: ученик может заплатить
// вперёд на несколько месяцев. Поля формы: periodMonth («2026-11») и months.
// todayIso — сегодня по часам школы (с сервера), чтобы список месяцев не зависел от часов браузера.
export function PeriodPicker({
  todayIso,
  defaultMonth,
  months: monthsControlled,
  onMonthsChange,
  defaultMonths = 1,
}: {
  todayIso: string;
  defaultMonth?: Date;
  months?: number;
  onMonthsChange?: (n: number) => void;
  defaultMonths?: number;
}) {
  const today = new Date(todayIso + "T00:00:00.000Z");
  const [month, setMonth] = useState(periodKey(defaultMonth ?? today));
  const [ownMonths, setOwnMonths] = useState(defaultMonths);
  const months = monthsControlled ?? ownMonths;
  const setMonths = (n: number) => {
    const v = Math.min(MAX_PERIOD_MONTHS, Math.max(1, n || 1));
    if (onMonthsChange) onMonthsChange(v);
    else setOwnMonths(v);
  };

  const options = periodOptions(today);
  // у старого счёта месяц может быть раньше списка — добавляем, чтобы правка его не сбросила
  if (!options.some((o) => o.value === month)) {
    const d = parsePeriodMonth(month);
    if (d) options.unshift({ value: month, label: periodLabel(d, 1) });
  }
  const start = parsePeriodMonth(month) ?? today;

  return (
    <>
      <div className="grid2">
        <div className="field">
          <label>За какой месяц</label>
          <select name="periodMonth" value={month} onChange={(e) => setMonth(e.target.value)}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>На сколько месяцев</label>
          <input name="months" type="number" min={1} max={MAX_PERIOD_MONTHS} value={months} onChange={(e) => setMonths(Number(e.target.value))} />
        </div>
      </div>
      <p className="mut" style={{ fontSize: 12, margin: "-4px 0 12px" }}>
        Оплата за: <b style={{ color: "var(--ink)" }}>{periodLabel(start, months)}</b>
        {months > 1 ? " — доля каждого предмета делится поровну между месяцами" : ""}
      </p>
    </>
  );
}
