const PLANS = [
  { plan: "1 месяц", months: 1, price: 18000 },
  { plan: "3 месяца", months: 3, price: 54000 },
  { plan: "6 месяцев", months: 6, price: 90000 },
  { plan: "Годовой", months: 12, price: 168000 },
  { plan: "ЕНТ-курс", months: 8, price: 120000 },
];

export function SubscriptionForm() {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <div className="field">
        <label>Тариф</label>
        <select name="plan" defaultValue="6 месяцев">
          {PLANS.map((p) => (
            <option key={p.plan} value={p.plan}>
              {p.plan}
            </option>
          ))}
        </select>
        <p className="mut" style={{ fontSize: 11, margin: 0 }}>
          Подсказки: 1 мес — 18 000 ₸ · 3 мес — 54 000 ₸ · 6 мес — 90 000 ₸ · год — 168 000 ₸
        </p>
      </div>
      <div className="grid2">
        <div className="field">
          <label>Месяцев</label>
          <input name="months" type="number" defaultValue={6} min={1} />
        </div>
        <div className="field">
          <label>Стоимость (₸)</label>
          <input name="price" type="number" defaultValue={90000} />
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
