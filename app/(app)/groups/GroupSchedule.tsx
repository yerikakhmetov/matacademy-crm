"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { DAYS } from "@/lib/format";

export type SlotRow = { dayOfWeek: number; startTime: string; room: string };

// Редактор расписания группы прямо в карточке группы: день + время начала + кабинет.
// Уходит на сервер одним скрытым полем `schedule` (JSON) — так строк может быть сколько угодно.
export function GroupSchedule({ rooms, value }: { rooms: string[]; value?: SlotRow[] }) {
  const roomList = rooms.length ? rooms : ["Каб. 1"];
  // кабинет, которого нет в настройках, всё равно показываем — иначе он потеряется при сохранении
  for (const s of value ?? []) if (!roomList.includes(s.room)) roomList.unshift(s.room);

  const [rows, setRows] = useState<SlotRow[]>(value ?? []);

  const patch = (i: number, p: Partial<SlotRow>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...p } : row)));

  const add = () =>
    setRows((r) => [
      ...r,
      // подставляем время последнего занятия — обычно все дни идут в одно время
      { dayOfWeek: 1, startTime: r[r.length - 1]?.startTime ?? "16:00", room: r[r.length - 1]?.room ?? roomList[0] },
    ]);

  const conflictHint = (i: number) =>
    rows.some((r, idx) => idx !== i && r.dayOfWeek === rows[i].dayOfWeek && r.startTime === rows[i].startTime);

  return (
    <div className="field">
      <label>Расписание занятий</label>
      <input type="hidden" name="schedule" value={JSON.stringify(rows)} />

      {rows.length === 0 && (
        <div className="mut" style={{ fontSize: 12.5, padding: "4px 0 8px" }}>
          Занятия не заданы — группа не появится в расписании
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 100px 1fr auto", gap: 8, alignItems: "center" }}>
            <select value={row.dayOfWeek} onChange={(e) => patch(i, { dayOfWeek: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5, 6].map((d) => (
                <option key={d} value={d}>
                  {DAYS[d]}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={row.startTime}
              onChange={(e) => patch(i, { startTime: e.target.value })}
              style={conflictHint(i) ? { borderColor: "var(--bad)" } : undefined}
            />
            <select value={row.room} onChange={(e) => patch(i, { room: e.target.value })}>
              {roomList.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn ghost"
              title="Убрать занятие"
              style={{ padding: "6px 9px", color: "var(--bad)" }}
              onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="btn ghost" style={{ marginTop: 8, padding: "6px 12px", fontSize: 12.5 }} onClick={add}>
        <Icon name="plus" size={14} />
        Добавить занятие
      </button>

      {rows.some((_, i) => conflictHint(i)) && (
        <div className="mut" style={{ fontSize: 12, marginTop: 6, color: "var(--bad)" }}>
          Два занятия в один день и в то же время — одно из них сохранено не будет
        </div>
      )}
    </div>
  );
}
