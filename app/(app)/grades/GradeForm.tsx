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
