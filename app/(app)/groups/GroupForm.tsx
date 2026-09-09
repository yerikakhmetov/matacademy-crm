import type { Teacher } from "@prisma/client";
import { GroupSchedule, type SlotRow } from "./GroupSchedule";

const COLORS = ["#3A5AE0", "#7048E8", "#0C8599", "#2F9E44", "#E8590C", "#C2255C"];

type Subject = { id: string; name: string };
type Values = {
  name?: string; level?: string; capacity?: number; color?: string;
  teacherId?: string | null; subjectId?: string | null; curatorId?: string | null;
  startDate?: Date | string | null; schedule?: SlotRow[];
};

// <input type="date"> понимает только YYYY-MM-DD
function dateValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
}

export function GroupForm({
  teachers,
  subjects = [],
  curators = [],
  rooms = [],
  values,
}: {
  teachers: Teacher[];
  subjects?: Subject[];
  curators?: { id: string; name: string }[];
  rooms?: string[];
  values?: Values;
}) {
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
        <label>Куратор</label>
        <select name="curatorId" defaultValue={values?.curatorId ?? ""}>
          <option value="">Не назначен</option>
          {curators.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <p className="mut" style={{ fontSize: 12, marginTop: 4 }}>
          Куратор видит эту группу, её расписание и журнал и отмечает посещаемость. Занятия не ведёт.
        </p>
      </div>
      <div className="field">
        <label>Занятия начинаются с</label>
        <input name="startDate" type="date" defaultValue={dateValue(values?.startDate)} />
        <p className="mut" style={{ fontSize: 12, marginTop: 4 }}>
          До этой даты занятий по расписанию нет: они не попадут в журнал, в календарь ученика и в расчёт зарплаты.
          Пусто — группа занимается давно.
        </p>
      </div>
      <GroupSchedule rooms={rooms} value={values?.schedule} />
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
