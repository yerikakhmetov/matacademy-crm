import type { Group } from "@prisma/client";
import { DAYS } from "@/lib/format";

export function LessonForm({ groups }: { groups: Group[] }) {
  return (
    <>
      <div className="field">
        <label>Группа *</label>
        <select name="groupId" required defaultValue="">
          <option value="" disabled>
            Выберите группу
          </option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid2">
        <div className="field">
          <label>День недели</label>
          <select name="dayOfWeek" defaultValue="1">
            {[1, 2, 3, 4, 5, 6].map((d) => (
              <option key={d} value={d}>
                {DAYS[d]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Время начала</label>
          <input name="startTime" type="time" defaultValue="16:00" />
        </div>
      </div>
      <div className="field">
        <label>Кабинет</label>
        <input name="room" defaultValue="Каб. 1" />
      </div>
    </>
  );
}
