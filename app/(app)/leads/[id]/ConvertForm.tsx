import type { Group } from "@prisma/client";

export function ConvertForm({ groups, defaultName, defaultGrade }: { groups: Group[]; defaultName: string; defaultGrade: string }) {
  return (
    <>
      <p className="mut" style={{ fontSize: 13, margin: 0 }}>
        Будет создан ученик, а лид перейдёт в этап «Оплатили». Родитель и телефон подставятся из лида.
      </p>
      <div className="field">
        <label>Имя ученика *</label>
        <input name="name" required defaultValue={defaultName} />
      </div>
      <div className="grid2">
        <div className="field">
          <label>Класс</label>
          <input name="grade" defaultValue={defaultGrade} />
        </div>
        <div className="field">
          <label>Группа</label>
          <select name="groupId" defaultValue="">
            <option value="">Без группы</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
