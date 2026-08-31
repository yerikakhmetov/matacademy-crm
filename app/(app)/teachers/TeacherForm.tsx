const COLORS = ["#3A5AE0", "#7048E8", "#0C8599", "#2F9E44", "#E8590C", "#C2255C"];

type Subject = { id: string; name: string; color: string };
type Values = { name?: string; specialty?: string; phone?: string | null; color?: string; rate?: number; rateType?: string; subjectIds?: string[] };

export function TeacherForm({ values, subjects = [] }: { values?: Values; subjects?: Subject[] }) {
  const selected = new Set(values?.subjectIds ?? []);
  return (
    <>
      <div className="field">
        <label>Имя преподавателя *</label>
        <input name="name" required placeholder="Мадина Жумабекова" defaultValue={values?.name ?? ""} />
      </div>
      {subjects.length > 0 && (
        <div className="field">
          <label>Предметы</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {subjects.map((s) => (
              <label
                key={s.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "6px 11px",
                  borderRadius: 20,
                  border: "1.5px solid var(--line-2)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <input type="checkbox" name="subjects" value={s.id} defaultChecked={selected.has(s.id)} />
                <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />
                {s.name}
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="field">
        <label>Специализация (описание)</label>
        <input name="specialty" placeholder="Алгебра · Геометрия" defaultValue={values?.specialty ?? ""} />
      </div>
      <div className="grid2">
        <div className="field">
          <label>Телефон</label>
          <input name="phone" placeholder="+7 701 …" defaultValue={values?.phone ?? ""} />
        </div>
        <div className="field">
          <label>Цвет</label>
          <select name="color" defaultValue={values?.color ?? COLORS[0]}>
            {COLORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid2">
        <div className="field">
          <label>Тип оплаты</label>
          <select name="rateType" defaultValue={values?.rateType ?? "PER_LESSON"}>
            <option value="PER_LESSON">За урок</option>
            <option value="PER_STUDENT">За ученика</option>
            <option value="PERCENT">% от оплат учеников</option>
          </select>
        </div>
        <div className="field">
          <label>Ставка</label>
          <input name="rate" type="number" defaultValue={values?.rate ?? 0} placeholder="напр. 3000" />
        </div>
      </div>
    </>
  );
}
