import type { Group } from "@prisma/client";

type Values = {
  name?: string;
  grade?: string | null;
  phone?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
  groupIds?: string[];
  status?: string;
  balance?: number;
};

export function StudentForm({ groups, values }: { groups: Group[]; values?: Values }) {
  const selected = new Set(values?.groupIds ?? []);
  return (
    <>
      <div className="field">
        <label>Имя ученика *</label>
        <input name="name" required defaultValue={values?.name ?? ""} placeholder="Алишер Нурланов" />
      </div>
      <div className="grid2">
        <div className="field">
          <label>Класс</label>
          <input name="grade" defaultValue={values?.grade ?? ""} placeholder="7 класс" />
        </div>
        <div className="field">
          <label>Телефон</label>
          <input name="phone" defaultValue={values?.phone ?? ""} placeholder="+7 701 …" />
        </div>
      </div>
      <div className="grid2">
        <div className="field">
          <label>Родитель</label>
          <input name="parentName" defaultValue={values?.parentName ?? ""} placeholder="Имя родителя" />
        </div>
        <div className="field">
          <label>Телефон родителя</label>
          <input name="parentPhone" defaultValue={values?.parentPhone ?? ""} placeholder="+7 701 …" />
        </div>
      </div>
      <div className="field">
        <label>Группы (можно несколько — по предметам)</label>
        {groups.length === 0 ? (
          <p className="mut" style={{ fontSize: 12.5, margin: 0 }}>Групп пока нет</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {groups.map((g) => (
              <label
                key={g.id}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 11px", borderRadius: 20, border: "1.5px solid var(--line-2)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
              >
                <input type="checkbox" name="groups" value={g.id} defaultChecked={selected.has(g.id)} />
                <span style={{ width: 9, height: 9, borderRadius: 3, background: g.color }} />
                {g.name}
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="field">
        <label>Статус</label>
        <select name="status" defaultValue={values?.status ?? "ACTIVE"}>
          <option value="ACTIVE">Активен</option>
          <option value="PAUSED">На паузе</option>
          <option value="LEFT">Ушёл</option>
        </select>
      </div>
      <p className="mut" style={{ fontSize: 12, margin: 0 }}>
        Задолженность рассчитывается автоматически из неоплаченных счетов — отдельно вводить не нужно.
      </p>
    </>
  );
}
