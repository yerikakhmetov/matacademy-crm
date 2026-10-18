// Форма зачёта: группа (только при создании), тема, дата и время по часам школы, заметка.
export function ZachetForm({
  groups,
  values,
  defaultDate,
}: {
  groups?: { id: string; name: string }[];
  values?: { topic: string; date: string; time: string; note: string | null };
  defaultDate: string; // сегодня по часам школы, YYYY-MM-DD
}) {
  return (
    <>
      {groups && (
        <div className="field">
          <label>Группа *</label>
          <select name="groupId" required defaultValue={groups.length === 1 ? groups[0].id : ""}>
            {groups.length !== 1 && (
              <option value="" disabled>
                Выберите группу
              </option>
            )}
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <label>Тема зачёта *</label>
        <input name="topic" required placeholder="Например: Модульдік теңсіздіктер" defaultValue={values?.topic ?? ""} />
      </div>
      <div className="grid2">
        <div className="field">
          <label>Дата *</label>
          <input name="date" type="date" required defaultValue={values?.date ?? defaultDate} />
        </div>
        <div className="field">
          <label>Время *</label>
          <input name="time" type="time" required defaultValue={values?.time ?? "15:00"} />
        </div>
      </div>
      <div className="field">
        <label>Заметка</label>
        <input name="note" placeholder="Кабинет, что повторить, что взять с собой" defaultValue={values?.note ?? ""} />
      </div>
      <p className="mut" style={{ fontSize: 12, margin: 0 }}>
        Родители видят тему, время и результат «сдал / не сдал» в своём портале, ученик — в кабинете.
      </p>
    </>
  );
}
