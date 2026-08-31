import type { Teacher } from "@prisma/client";

const COLORS = ["#3A5AE0", "#7048E8", "#0C8599", "#2F9E44", "#E8590C", "#C2255C"];

type Subject = { id: string; name: string };
type Values = { name?: string; level?: string; capacity?: number; color?: string; teacherId?: string | null; subjectId?: string | null };

export function GroupForm({ teachers, subjects = [], values }: { teachers: Teacher[]; subjects?: Subject[]; values?: Values }) {
  return (
    <>
      <div className="field">
        <label>Название группы *</label>
        <input name="name" required placeholder="Алгебра · Pro" defaultValue={values?.name ?? ""} />
      </div>
      <div className="grid2">
        <div className="field">
          <label>Уровень / класс</label>
          <input name="level" placeholder="7 класс" defaultValue={values?.level ?? ""} />
        </div>
        <div className="field">
          <label>Вместимость</label>
          <input name="capacity" type="number" defaultValue={values?.capacity ?? 12} />
        </div>
      </div>
      <div className="grid2">
        <div className="field">
          <label>Преподаватель</label>
          <select name="teacherId" defaultValue={values?.teacherId ?? ""}>
            <option value="">Не назначен</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Предмет</label>
          <select name="subjectId" defaultValue={values?.subjectId ?? ""}>
            <option value="">Не указан</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
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
    </>
  );
}
