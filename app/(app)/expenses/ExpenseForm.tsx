import { EXPENSE_CATEGORIES } from "@/lib/expenses";

type Values = {
  title?: string;
  amount?: number;
  category?: string;
  date?: Date | string;
  note?: string | null;
  recurring?: boolean;
};

export function ExpenseForm({ values }: { values?: Values }) {
  const date =
    values?.date instanceof Date
      ? values.date.toISOString().slice(0, 10)
      : typeof values?.date === "string"
        ? values.date.slice(0, 10)
        : new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="field">
        <label>За что *</label>
        <input name="title" required defaultValue={values?.title ?? ""} placeholder="Например: свет за октябрь, таргет в Instagram" />
      </div>
      <div className="field">
        <label>Категория</label>
        <select name="category" defaultValue={values?.category ?? "UTILITIES"}>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label} — {c.hint}
            </option>
          ))}
        </select>
      </div>
      <div className="grid2">
        <div className="field">
          <label>Сумма (₸) *</label>
          <input name="amount" type="number" min={1} required defaultValue={values?.amount ?? ""} />
        </div>
        <div className="field">
          <label>Дата</label>
          <input name="date" type="date" defaultValue={date} />
        </div>
      </div>
      <div className="field">
        <label>Комментарий</label>
        <input name="note" defaultValue={values?.note ?? ""} placeholder="Необязательно: номер счёта, поставщик" />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5 }}>
        <input type="checkbox" name="recurring" defaultChecked={values?.recurring ?? false} />
        Ежемесячный расход — можно перенести в следующий месяц одной кнопкой
      </label>
    </>
  );
}
