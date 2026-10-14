"use client";

import { useState } from "react";
import { MAX_PERIOD_MONTHS } from "@/lib/period";
import { studyMonthLabel } from "@/lib/packages";

// «Какой месяц обучения» при приёме оплаты и выставлении счёта. Месяц обучения —
// пакет занятий (12 по выборному предмету, 8 по обязательному), а не календарный месяц:
// ученик может начать 14-го, заболеть, и пакет просто растянется.
// Поля формы: studyMonth (пусто — следующий по порядку у ученика) и months.
export function StudyMonthPicker({
  defaultStudyMonth,
  months: monthsControlled,
  onMonthsChange,
  defaultMonths = 1,
}: {
  /** номер, который предложить; undefined — сервер подставит следующий сам */
  defaultStudyMonth?: number | null;
  months?: number;
  onMonthsChange?: (n: number) => void;
  defaultMonths?: number;
}) {
  const [first, setFirst] = useState<string>(defaultStudyMonth ? String(defaultStudyMonth) : "");
  const [ownMonths, setOwnMonths] = useState(defaultMonths);
  const months = monthsControlled ?? ownMonths;
  const setMonths = (n: number) => {
    const v = Math.min(MAX_PERIOD_MONTHS, Math.max(1, n || 1));
    if (onMonthsChange) onMonthsChange(v);
    else setOwnMonths(v);
  };
  const n = Number(first);

  return (
    <>
      <div className="grid2">
        <div className="field">
          <label>Месяц обучения</label>
          <input
            name="studyMonth"
            type="number"
            min={1}
            value={first}
            placeholder="следующий"
            onChange={(e) => setFirst(e.target.value)}
          />
        </div>
        <div className="field">
          <label>На сколько месяцев</label>
          <input name="months" type="number" min={1} max={MAX_PERIOD_MONTHS} value={months} onChange={(e) => setMonths(Number(e.target.value))} />
        </div>
      </div>
      <p className="mut" style={{ fontSize: 12, margin: "-4px 0 12px", lineHeight: 1.45 }}>
        Оплата за:{" "}
        <b style={{ color: "var(--ink)" }}>
          {n >= 1 ? studyMonthLabel(n, months) : months > 1 ? `следующие ${months} мес. обучения` : "следующий месяц обучения"}
        </b>
        . Месяц обучения — пакет занятий (12, по обязательным предметам 8), а не календарный месяц.
      </p>
    </>
  );
}
