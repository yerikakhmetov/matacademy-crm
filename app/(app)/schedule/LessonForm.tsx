import type { Group } from "@prisma/client";
import { DAYS } from "@/lib/format";

type Values = { groupId?: string; dayOfWeek?: number; startTime?: string; room?: string };

export function LessonForm({ groups, rooms, values }: { groups: Group[]; rooms: string[]; values?: Values }) {
  const roomList = rooms.length ? rooms : ["Каб. 1"];
  // если кабинет занятия не из списка настроек — добавим его, чтобы не потерять
  if (values?.room && !roomList.includes(values.room)) roomList.unshift(values.room);
  return (
    <>
      <div className="field">
        <label>Группа *</label>
        <select name="groupId" required defaultValue={values?.groupId ?? ""}>
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
          <select name="dayOfWeek" defaultValue={String(values?.dayOfWeek ?? 1)}>
            {[1, 2, 3, 4, 5, 6].map((d) => (
              <option key={d} value={d}>
                {DAYS[d]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Время начала</label>
          <input name="startTime" type="time" defaultValue={values?.startTime ?? "16:00"} />
        </div>
      </div>
      <div className="field">
        <label>Кабинет</label>
        <select name="room" defaultValue={values?.room ?? roomList[0]}>
          {roomList.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
