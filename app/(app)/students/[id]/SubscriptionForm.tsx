"use client";

import { useMemo, useState } from "react";

type Subject = { id: string; name: string; price: number; color: string };
type Discount = { name: string; percent: number };
type MultiTier = { count: number; percent: number };

const fmt = (n: number) => n.toLocaleString("ru-RU") + " ₸";

function multiPercentFor(count: number, tiers: MultiTier[]): number {
  let pct = 0;
  for (const t of [...tiers].sort((a, b) => a.count - b.count)) if (count >= t.count) pct = t.percent;
  return pct;
}

export function SubscriptionForm({
  subjects,
  discounts,
  tiers,
}: {
  subjects: Subject[];
  discounts: Discount[];
  tiers: MultiTier[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const hasSubjects = subjects.length > 0;

  const [picked, setPicked] = useState<string[]>([]);
  const [months, setMonths] = useState(1);
  const [discountName, setDiscountName] = useState("");

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const calc = useMemo(() => {
    const chosen = picked.map((id) => subjects.find((s) => s.id === id)!).filter(Boolean);
    const base = chosen.reduce((a, s) => a + s.price, 0) * Math.max(1, months);
    const discountPct = discounts.find((d) => d.name === discountName)?.percent ?? 0;
    const multiPct = multiPercentFor(chosen.length, tiers);
    const totalPct = Math.min(100, discountPct + multiPct);
    const total = Math.round((base * (100 - totalPct)) / 100);
    // доли по предметам (последнему — остаток)
    let acc = 0;
    const rows = chosen.map((s, i) => {
      const b = s.price * Math.max(1, months);
      let amount: number;
      if (i === chosen.length - 1) amount = total - acc;
      else {
        amount = base > 0 ? Math.round((total * b) / base) : 0;
        acc += amount;
      }
      return { ...s, b, amount };
    });
    return { base, total, discountPct, multiPct, totalPct, rows, saved: base - total };
  }, [picked, months, discountName, subjects, discounts, tiers]);

  if (!hasSubjects) {
    // Резервный режим: предметы не заданы — ручная цена
    return (
      <>
        <div className="field">
          <label>Название</label>
          <input name="plan" placeholder="Абонемент" defaultValue="Абонемент" />
        </div>
        <div className="grid2">
          <div className="field">
            <label>Месяцев</label>
            <input name="months" type="number" min={1} defaultValue={1} />
          </div>
          <div className="field">
            <label>Стоимость (₸)</label>
            <input name="price" type="number" min={0} defaultValue={0} />
          </div>
        </div>
        <div className="field">
          <label>Дата начала</label>
          <input name="startDate" type="date" defaultValue={today} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>
          <input type="checkbox" name="invoice" defaultChecked value="on" />
          Выставить счёт на оплату
        </label>
        <p className="mut" style={{ fontSize: 12, marginTop: 8 }}>
          Добавьте предметы в разделе «Предметы и цены» — тогда абонемент считается автоматически со скидками.
        </p>
      </>
    );
  }

  return (
    <>
      <div className="field">
        <label>Предметы</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {subjects.map((s) => {
            const on = picked.includes(s.id);
            return (
              <label
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  borderRadius: 10,
                  border: `1.5px solid ${on ? "var(--accent)" : "var(--line-2)"}`,
                  background: on ? "var(--accent-soft)" : "transparent",
                  cursor: "pointer",
                }}
              >
                <input type="checkbox" name="subjects" value={s.id} checked={on} onChange={() => toggle(s.id)} />
                <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flex: "none" }} />
                <span style={{ flex: 1, fontWeight: 600 }}>{s.name}</span>
                <span className="num mut">{fmt(s.price)}/мес</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label>Месяцев</label>
          <input name="months" type="number" min={1} value={months} onChange={(e) => setMonths(Math.max(1, Number(e.target.value)))} />
        </div>
        <div className="field">
          <label>Дата начала</label>
          <input name="startDate" type="date" defaultValue={today} />
        </div>
      </div>

      {discounts.length > 0 && (
        <div className="field">
          <label>Спец-скидка</label>
          <select name="discount" value={discountName} onChange={(e) => setDiscountName(e.target.value)}>
            <option value="">Без скидки</option>
            {discounts.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name} (−{d.percent}%)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Расчёт */}
      <div className="card" style={{ padding: 14, background: "var(--surface-2)", border: "1px solid var(--line-2)" }}>
        {calc.rows.length === 0 ? (
          <div className="mut" style={{ fontSize: 13 }}>Выберите хотя бы один предмет</div>
        ) : (
          <>
            {calc.rows.map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                <span>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: r.color, marginRight: 7 }} />
                  {r.name}
                </span>
                <span className="num">{fmt(r.amount)}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid var(--line-2)", margin: "8px 0", paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }} className="mut">
                <span>База ({months} мес)</span>
                <span className="num">{fmt(calc.base)}</span>
              </div>
              {calc.multiPct > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--violet)" }}>
                  <span>Несколько предметов</span>
                  <span className="num">−{calc.multiPct}%</span>
                </div>
              )}
              {calc.discountPct > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--accent)" }}>
                  <span>{discountName}</span>
                  <span className="num">−{calc.discountPct}%</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 16, marginTop: 4 }}>
                <span>Итого</span>
                <span className="num">{fmt(calc.total)}</span>
              </div>
              {calc.saved > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ok)" }}>
                  <span>Выгода</span>
                  <span className="num">{fmt(calc.saved)}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>
        <input type="checkbox" name="invoice" defaultChecked value="on" />
        Выставить счёт на оплату (появится в «Оплатах» со статусом «Ожидает»)
      </label>
    </>
  );
}
