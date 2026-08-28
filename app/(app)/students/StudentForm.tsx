import type { Group } from "@prisma/client";

type Values = {
  name?: string;
  grade?: string | null;
  phone?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
  groupId?: string | null;
  status?: string;
  balance?: number;
};

export function StudentForm({ groups, values }: { groups: Group[]; values?: Values }) {
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
      <div className="grid2">
        <div className="field">
          <label>Группа</label>
          <select name="groupId" defaultValue={values?.groupId ?? ""}>
            <option value="">Без группы</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Статус</label>
          <select name="status" defaultValue={values?.status ?? "ACTIVE"}>
            <option value="ACTIVE">Активен</option>
            <option value="PAUSED">На паузе</option>
            <option value="LEFT">Ушёл</option>
          </select>
        </div>
      </div>
      <p className="mut" style={{ fontSize: 12, margin: 0 }}>
        Задолженность рассчитывается автоматически из неоплаченных счетов — отдельно вводить не нужно.
      </p>
    </>
  );
}
