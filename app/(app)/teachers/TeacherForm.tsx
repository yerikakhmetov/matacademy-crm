const COLORS = ["#3A5AE0", "#7048E8", "#0C8599", "#2F9E44", "#E8590C", "#C2255C"];

type Values = { name?: string; specialty?: string; phone?: string | null; color?: string; rate?: number; rateType?: string };

export function TeacherForm({ values }: { values?: Values }) {
  return (
    <>
      <div className="field">
        <label>Имя преподавателя *</label>
        <input name="name" required placeholder="Мадина Жумабекова" defaultValue={values?.name ?? ""} />
      </div>
      <div className="field">
        <label>Специализация</label>
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
