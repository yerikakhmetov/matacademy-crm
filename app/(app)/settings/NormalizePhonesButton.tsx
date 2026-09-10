"use client";

import { useState, useTransition } from "react";
import { normalizeAllPhones } from "@/app/actions/data";
import { Icon } from "@/components/Icon";

// Разовая уборка: приводит уже накопленные телефоны к единому виду.
// Кнопку можно нажимать сколько угодно — второй раз менять будет нечего.
export function NormalizePhonesButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ changed: number; checked: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setError(null);
    setResult(null);
    start(async () => {
      try {
        setResult(await normalizeAllPhones());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не получилось");
      }
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
      <button className="btn ghost" type="button" onClick={run} disabled={pending}>
        <Icon name="phone" size={15} />
        {pending ? "Приводим…" : "Привести телефоны к единому виду"}
      </button>
      {result && (
        <span className={`chip ${result.changed > 0 ? "c-ok" : "c-mut"}`}>
          <span className="d" />
          {result.changed > 0
            ? `Исправлено номеров: ${result.changed} из ${result.checked}`
            : "Все телефоны уже в едином виде"}
        </span>
      )}
      {error && <span className="chip c-bad"><span className="d" />{error}</span>}
    </div>
  );
}
