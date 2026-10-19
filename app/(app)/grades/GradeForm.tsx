import { GRADE_TYPE } from "@/lib/format";

export function GradeForm({ groupId }: { groupId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      {/* оценка ставится за конкретную группу, иначе она всплывёт во всех группах ученика */}
      <input type="hidden" name="groupId" value={groupId} />
      <div className="field">
        <label>За что *</label>
        <input name="topic" required placeholder="Контрольная: дроби" />
      </div>
      <div className="grid2">
        <div className="field">
          <label>Тип</label>
          <select name="type" defaultValue="TEST">
            {Object.entries(GRADE_TYPE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Дата</label>
          <input name="date" type="date" defaultValue={today} />
        </div>
      </div>
      <div className="grid2">
        <div className="field">
          <label>Балл *</label>
          <input name="score" type="number" required placeholder="8" min={0} />
        </div>
        <div className="field">
          <label>Из скольки</label>
          <input name="maxScore" type="number" defaultValue={10} min={1} />
        </div>
      </div>
      <div className="field">
        <label>Комментарий</label>
        <input name="comment" placeholder="Молодец / нужно повторить тему" />
      </div>
    </>
  );
}

// Оценки всей группе: общие тема, вид, дата и максимум, балл — напротив каждого ученика.
export function BulkGradeForm({ students }: { students: { id: string; name: string }[] }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <div className="field">
        <label>За что *</label>
        <input name="topic" required placeholder="ДЗ: дроби" />
      </div>
      <div className="grid2">
        <div className="field">
          <label>Тип</label>
          <select name="type" defaultValue="HOMEWORK">
            {Object.entries(GRADE_TYPE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Дата</label>
          <input name="date" type="date" defaultValue={today} />
        </div>
      </div>
      <div className="field">
        <label>Из скольки</label>
        <input name="maxScore" type="number" defaultValue={10} min={1} />
      </div>
      <div className="field">
        <label>Баллы · пустое поле — без оценки</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {students.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5 }}>{s.name}</span>
              <input name={`score_${s.id}`} inputMode="decimal" aria-label={`Балл: ${s.name}`} style={{ width: 80, flex: "none" }} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
