type Group = { id: string; name: string };
type Subject = { id: string; name: string };

export function TestForm({ groups, subjects = [] }: { groups: Group[]; subjects?: Subject[] }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <div className="field">
        <label>Название теста *</label>
        <input name="title" required placeholder="Контрольная: дроби" />
      </div>
      <div className="grid2">
        <div className="field">
          <label>Предмет</label>
          <select name="subjectId" defaultValue="">
            <option value="">Не указан</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Группа (для ввода баллов)</label>
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
      <div className="field">
        <label>Ограничение по времени, мин</label>
        <input name="timeLimitMin" type="number" min={1} placeholder="пусто — без ограничения" />
        <span className="mut" style={{ fontSize: 11.5 }}>
          Ответы сохраняются по ходу, поэтому закрытая вкладка не обнуляет работу.
        </span>
      </div>
      <div className="field">
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, color: "var(--ink-2)", fontSize: 13 }}>
          <input type="checkbox" name="shuffle" value="on" />
          Перемешивать вопросы у каждого ученика
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, color: "var(--ink-2)", fontSize: 13, marginTop: 8 }}>
          <input type="checkbox" name="allowRetake" value="on" />
          Разрешить пройти заново
        </label>
      </div>
    </>
  );
}
