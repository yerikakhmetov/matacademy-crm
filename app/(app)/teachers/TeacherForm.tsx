const COLORS = ["#3A5AE0", "#7048E8", "#0C8599", "#2F9E44", "#E8590C", "#C2255C"];

export function TeacherForm() {
  return (
    <>
      <div className="field">
        <label>Имя преподавателя *</label>
        <input name="name" required placeholder="Мадина Жумабекова" />
      </div>
      <div className="field">
        <label>Специализация</label>
        <input name="specialty" placeholder="Алгебра · Геометрия" />
      </div>
      <div className="grid2">
        <div className="field">
          <label>Телефон</label>
          <input name="phone" placeholder="+7 701 …" />
        </div>
        <div className="field">
          <label>Цвет</label>
          <select name="color" defaultValue={COLORS[0]}>
            {COLORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
