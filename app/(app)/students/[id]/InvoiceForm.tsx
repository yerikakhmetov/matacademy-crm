"use client";

import { useMemo, useState } from "react";
import { PeriodPicker } from "@/components/PeriodPicker";
import { multiTierFor, computePricing, type Discount, type MultiTier, type DiscountMode } from "@/lib/pricing";

type Subject = { id: string; name: string; price: number; lessonsPerMonth: number; color: string };

const fmt = (n: number) => n.toLocaleString("ru-RU") + " ₸";

// Счёт за обучение: предметы по прайсу со скидками. Создаёт счёт со статусом «Ожидает».
export function InvoiceForm({
  subjects,
  discounts,
  tiers,
  mode = "add",
  personalPct = 0,
  siblingPct = 0,
  promos = [],
  todayIso,
}: {
  subjects: Subject[];
  discounts: Discount[];
  tiers: MultiTier[];
  mode?: DiscountMode;
  personalPct?: number;
  siblingPct?: number;
  promos?: { code: string; percent: number }[];
  todayIso: string; // сегодня по часам школы
}) {
  const hasSubjects = subjects.length > 0;

  const [picked, setPicked] = useState<string[]>([]);
  const [months, setMonths] = useState(1);
  const [discountName, setDiscountName] = useState("");
  const [promo, setPromo] = useState("");

  const promoNorm = promo.trim().toUpperCase().replace(/\s+/g, "");
  const promoMatch = promoNorm ? promos.find((p) => p.code === promoNorm) : undefined;
  const promoPct = promoMatch?.percent ?? 0;

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const calc = useMemo(() => {
    const chosen = picked.map((id) => subjects.find((s) => s.id === id)!).filter(Boolean);
    const discountPct = discounts.find((d) => d.name === discountName)?.percent ?? 0;
    const tier = multiTierFor(chosen.length, tiers);
    const packagePrice = tier?.fixed ?? null;
    const multiTierPct = packagePrice != null ? 0 : (tier?.percent ?? 0);
    const pricing = computePricing({
      subjects: chosen.map((s) => ({ id: s.id, name: s.name, price: s.price, lessonsPerMonth: s.lessonsPerMonth })),
      months,
      discountParts: [discountPct, multiTierPct, personalPct, siblingPct, promoPct],
      mode,
      packagePrice,
    });
    const multiPct = packagePrice != null ? pricing.packagePct : multiTierPct;
    const colorById = new Map(chosen.map((s) => [s.id, s.color]));
    const rows = pricing.items.map((it) => ({ id: it.id, name: it.name, color: colorById.get(it.id) ?? "#999", b: it.base, amount: it.amount }));
    return {
      base: pricing.base,
      total: pricing.total,
      discountPct,
      multiPct,
      packagePrice: pricing.packagePrice,
      totalPct: pricing.totalPct,
      rows,
      saved: pricing.base - pricing.total,
    };
  }, [picked, months, discountName, subjects, discounts, tiers, mode, personalPct, siblingPct, promoPct]);

  if (!hasSubjects) {
    // Резервный режим: предметы не заданы — ручная цена
    return (
      <>
        <div className="field">
          <label>Назначение</label>
          <input name="plan" placeholder="Обучение" defaultValue="Обучение" />
        </div>
        <div className="field">
          <label>Стоимость (₸)</label>
          <input name="price" type="number" min={0} defaultValue={0} />
        </div>
        <PeriodPicker todayIso={todayIso} />
        <p className="mut" style={{ fontSize: 12, marginTop: 8 }}>
          Добавьте предметы в разделе «Предметы и цены» — тогда сумма считается автоматически со скидками.
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

      <PeriodPicker todayIso={todayIso} months={months} onMonthsChange={setMonths} />

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

      {promos.length > 0 && (
        <div className="field">
          <label>Промокод</label>
          <input name="promo" value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Например: SEPT2026" autoComplete="off" style={{ textTransform: "uppercase" }} />
          {promoNorm && (promoMatch
            ? <span className="mut" style={{ fontSize: 11.5, color: "var(--ok)" }}>Код применён: −{promoMatch.percent}%</span>
            : <span className="mut" style={{ fontSize: 11.5, color: "var(--bad)" }}>Код не найден или отключён</span>)}
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
              {calc.packagePrice != null ? (
                // цена пакета задана суммой — показываем её, а не округлённый процент
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--violet)" }}>
                  <span>Пакет · {calc.rows.length} предмета</span>
                  <span className="num">{fmt(calc.packagePrice)}</span>
                </div>
              ) : (
                calc.multiPct > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--violet)" }}>
                    <span>Несколько предметов</span>
                    <span className="num">−{calc.multiPct}%</span>
                  </div>
                )
              )}
              {calc.discountPct > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--accent)" }}>
                  <span>{discountName}</span>
                  <span className="num">−{calc.discountPct}%</span>
                </div>
              )}
              {personalPct > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--accent)" }}>
                  <span>Персональная скидка</span>
                  <span className="num">−{personalPct}%</span>
                </div>
              )}
              {siblingPct > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--accent)" }}>
                  <span>Брат/сестра</span>
                  <span className="num">−{siblingPct}%</span>
                </div>
              )}
              {promoPct > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--accent)" }}>
                  <span>Промокод {promoNorm}</span>
                  <span className="num">−{promoPct}%</span>
                </div>
              )}
              {mode !== "add" && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink-3)" }}>
                  <span>Итоговая скидка</span>
                  <span className="num">−{calc.totalPct}%</span>
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

      <p className="mut" style={{ fontSize: 12, margin: 0 }}>
        Счёт появится в «Оплатах» со статусом «Ожидает». Зарплата преподавателю и куратору начисляется только с оплаченной части;
        счёт на несколько месяцев делится между ними поровну.
      </p>
    </>
  );
}
