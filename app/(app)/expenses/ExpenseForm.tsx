import { EXPENSE_CATEGORY } from "@/lib/format";

type Values = { title?: string; amount?: number; category?: string; date?: Date | string; note?: string | null };

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
        <input name="title" required defaultValue={values?.title ?? ""} placeholder="Аренда за сентябрь" />
      </div>
      <div className="grid2">
        <div className="field">
          <label>Категория</label>
          <select name="category" defaultValue={values?.category ?? "RENT"}>
            {Object.entries(EXPENSE_CATEGORY).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Сумма (₸) *</label>
          <input name="amount" type="number" min={1} required defaultValue={values?.amount ?? ""} />
        </div>
      </div>
      <div className="field">
        <label>Дата</label>
        <input name="date" type="date" defaultValue={date} />
      </div>
      <div className="field">
        <label>Комментарий</label>
        <input name="note" defaultValue={values?.note ?? ""} placeholder="Необязательно" />
      </div>
    </>
  );
}
