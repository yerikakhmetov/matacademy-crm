"use client";

const COLORS = ["#3A5AE0", "#7A5CFF", "#12B886", "#F59F00", "#E8590C", "#E64980", "#1098AD", "#495057"];

type Values = { name?: string; price?: number; lessonsPerMonth?: number; color?: string; active?: boolean };

export function SubjectForm({ values }: { values?: Values }) {
  return (
    <>
      <div className="field">
        <label>Название *</label>
        <input name="name" required placeholder="Математика" defaultValue={values?.name ?? ""} />
      </div>
      <div className="grid2">
        <div className="field">
          <label>Цена за месяц (₸)</label>
          <input name="price" type="number" min={0} placeholder="24000" defaultValue={values?.price ?? ""} />
        </div>
        <div className="field">
          <label>Занятий в месяц</label>
          <input name="lessonsPerMonth" type="number" min={0} placeholder="12" defaultValue={values?.lessonsPerMonth || ""} />
        </div>
      </div>
      <p className="mut" style={{ fontSize: 12, margin: "-6px 0 10px" }}>
        По числу занятий платёж делится между предметами абонемента: занятие стоит одинаково в любом предмете.
        {values?.price && values?.lessonsPerMonth
          ? ` Сейчас — ${Math.round(values.price / values.lessonsPerMonth).toLocaleString("ru-RU")} ₸ за занятие.`
          : ""}
      </p>
      <div className="field">
        <label>Цвет</label>
        <div className="color-pick" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {COLORS.map((c, i) => (
            <label key={c} style={{ cursor: "pointer", lineHeight: 0 }}>
              <input
                type="radio"
                name="color"
                value={c}
                defaultChecked={values?.color ? values.color === c : i === 0}
              />
              <span style={{ display: "block", width: 26, height: 26, borderRadius: 8, background: c }} />
            </label>
          ))}
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>
        <input type="checkbox" name="active" value="on" defaultChecked={values?.active ?? true} />
        Активен (доступен для абонементов)
      </label>
    </>
  );
}
