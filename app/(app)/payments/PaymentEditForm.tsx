import { PAYMENT_METHODS, money } from "@/lib/format";

type StudentLite = { id: string; name: string };
type Subject = { id: string; name: string; color: string };

// Исправление счёта или принятой оплаты. Поля заполнены текущими значениями.
export function PaymentEditForm({
  students,
  subjects = [],
  value,
  canFixReceived,
}: {
  students: StudentLite[];
  subjects?: Subject[];
  value: {
    studentId: string;
    purpose: string;
    amount: number;
    paidAmount: number;
    method: string | null;
    date: Date;
    subjectIds: string[];
  };
  /** оплата принята одним движением целиком — можно исправить и принятую сумму */
  canFixReceived: boolean;
}) {
  const methods = value.method && !PAYMENT_METHODS.includes(value.method) ? [value.method, ...PAYMENT_METHODS] : PAYMENT_METHODS;
  return (
    <>
      <div className="field">
        <label>Ученик</label>
        <select name="studentId" defaultValue={value.studentId}>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Назначение</label>
        <input name="purpose" defaultValue={value.purpose} />
      </div>
      <div className="grid2">
        <div className="field">
          <label>Сумма (₸)</label>
          <input name="amount" type="number" min={1} required defaultValue={value.amount} />
        </div>
        <div className="field">
          <label>Способ оплаты</label>
          <select name="method" defaultValue={value.method ?? ""}>
            <option value="">Не указан</option>
            {methods.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Дата</label>
        <input name="date" type="date" defaultValue={value.date.toISOString().slice(0, 10)} />
      </div>

      {canFixReceived ? (
        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--ink-2)", marginBottom: 12 }}>
          <input type="checkbox" name="alsoReceived" value="on" defaultChecked style={{ marginTop: 3 }} />
          <span>
            <b>Столько же и получено</b> — исправить принятую сумму вместе со счётом. Снимите галочку, если деньги
            пришли верно, а неверна только сумма счёта (тогда разница станет долгом).
          </span>
        </label>
      ) : (
        value.paidAmount > 0 && (
          <p className="mut" style={{ fontSize: 12.5, margin: "0 0 12px" }}>
            По счёту уже принято <b>{money(value.paidAmount)}</b>. Меняется только сумма счёта — она не может быть
            меньше принятого. Лишние деньги оформите возвратом.
          </p>
        )
      )}

      {subjects.length > 0 && (
        <div className="field">
          <label>За какие предметы</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {subjects.map((s) => (
              <label
                key={s.id}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 11px", borderRadius: 20, border: "1.5px solid var(--line-2)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
              >
                <input type="checkbox" name="subjects" value={s.id} defaultChecked={value.subjectIds.includes(s.id)} />
                <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />
                {s.name}
              </label>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
