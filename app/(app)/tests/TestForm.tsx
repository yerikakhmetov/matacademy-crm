type Group = { id: string; name: string };

export function TestForm({ groups }: { groups: Group[] }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <div className="field">
        <label>Название теста *</label>
        <input name="title" required placeholder="Контрольная: дроби" />
      </div>
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
          <label>Дата</label>
          <input name="date" type="date" defaultValue={today} />
        </div>
        <div className="field">
          <label>Макс. балл</label>
          <input name="maxScore" type="number" min={1} defaultValue={100} />
        </div>
      </div>
    </>
  );
}
