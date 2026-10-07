type Group = { id: string; name: string };
type Subject = { id: string; name: string };

export function TestForm({
  groups,
  subjects = [],
  selected,
}: {
  groups: Group[];
  subjects?: Subject[];
  /** уже отмеченные группы (при редактировании) */
  selected?: string[];
}) {
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
          <label>Основная группа (для ввода баллов)</label>
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
      {/* Один тест можно дать нескольким группам: каждая откроет его после
          своего урока в день теста. */}
      <div className="field">
        <label>Кому доступен тест</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {groups.map((g) => (
            <label
              key={g.id}
              className="chip c-mut"
              style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px" }}
            >
              <input type="checkbox" name="groupIds" value={g.id} defaultChecked={selected?.includes(g.id)} />
              {g.name}
            </label>
          ))}
          {groups.length === 0 && <span className="mut" style={{ fontSize: 12.5 }}>Групп пока нет</span>}
        </div>
        <p className="mut" style={{ fontSize: 12, marginTop: 6 }}>
          Отметьте все группы, которые проходят этот тест. Каждая группа получит его после своего урока
          в день теста. Основная группа добавляется автоматически.
        </p>
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
