"use client";

import { useState } from "react";
import type { Tariff } from "@/lib/settings";

export function SubscriptionForm({ tariffs }: { tariffs: Tariff[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [idx, setIdx] = useState(0);
  const [months, setMonths] = useState(tariffs[0]?.months ?? 6);
  const [price, setPrice] = useState(tariffs[0]?.price ?? 90000);

  const onTariff = (i: number) => {
    setIdx(i);
    const t = tariffs[i];
    if (t) {
      setMonths(t.months);
      setPrice(t.price);
    }
  };

  return (
    <>
      <div className="field">
        <label>Тариф</label>
        <select name="plan" value={tariffs[idx]?.plan ?? ""} onChange={(e) => onTariff(tariffs.findIndex((t) => t.plan === e.target.value))}>
          {tariffs.map((t, i) => (
            <option key={i} value={t.plan}>
              {t.plan} — {t.price.toLocaleString("ru-RU")} ₸
            </option>
          ))}
        </select>
      </div>
      <div className="grid2">
        <div className="field">
          <label>Месяцев</label>
          <input name="months" type="number" value={months} min={1} onChange={(e) => setMonths(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Стоимость (₸)</label>
          <input name="price" type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </div>
      </div>
      <div className="field">
        <label>Дата начала</label>
        <input name="startDate" type="date" defaultValue={today} />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>
        <input type="checkbox" name="invoice" defaultChecked value="on" />
        Выставить счёт на оплату (появится в «Оплатах» со статусом «Ожидает»)
      </label>
    </>
  );
}
