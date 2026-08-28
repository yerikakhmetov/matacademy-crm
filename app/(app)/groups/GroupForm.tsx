import type { Teacher } from "@prisma/client";

const COLORS = ["#3A5AE0", "#7048E8", "#0C8599", "#2F9E44", "#E8590C", "#C2255C"];

export function GroupForm({ teachers }: { teachers: Teacher[] }) {
  return (
    <>
      <div className="field">
        <label>Название группы *</label>
        <input name="name" required placeholder="Алгебра · Pro" />
      </div>
      <div className="grid2">
        <div className="field">
          <label>Уровень / класс</label>
          <input name="level" placeholder="7 класс" />
        </div>
        <div className="field">
          <label>Вместимость</label>
          <input name="capacity" type="number" defaultValue={12} />
        </div>
      </div>
      <div className="field">
        <label>Преподаватель</label>
        <select name="teacherId" defaultValue="">
          <option value="">Не назначен</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
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
    </>
  );
}
