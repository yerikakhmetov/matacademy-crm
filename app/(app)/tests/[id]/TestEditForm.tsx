"use client";

type Subject = { id: string; name: string };

// Правка уже созданного теста: дату, название и настройки нередко нужно
// поменять после импорта — пересоздавать тест нельзя, вместе с ним ушли бы
// попытки и оценки учеников.
export function TestEditForm({
  values,
  subjects,
}: {
  values: {
    title: string;
    subjectId: string | null;
    date: string; // YYYY-MM-DD
    maxScore: number;
    timeLimitMin: number | null;
    shuffle: boolean;
    allowRetake: boolean;
  };
  subjects: Subject[];
}) {
  return (
    <>
      <div className="field">
        <label>Название теста *</label>
        <input name="title" required defaultValue={values.title} />
      </div>
      <div className="grid2">
        <div className="field">
          <label>Предмет</label>
          <select name="subjectId" defaultValue={values.subjectId ?? ""}>
            <option value="">Не указан</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Дата теста</label>
          <input name="date" type="date" defaultValue={values.date} />
          <span className="mut" style={{ fontSize: 11.5 }}>
            От неё считается открытие: в этот день после урока каждой группы.
          </span>
        </div>
      </div>
      <div className="grid2">
        <div className="field">
          <label>Макс. балл</label>
          <input name="maxScore" type="number" min={1} defaultValue={values.maxScore} />
        </div>
        <div className="field">
          <label>Ограничение по времени, мин</label>
          <input name="timeLimitMin" type="number" min={1} defaultValue={values.timeLimitMin ?? ""} placeholder="без ограничения" />
        </div>
      </div>
      <div className="field">
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, color: "var(--ink-2)", fontSize: 13 }}>
          <input type="checkbox" name="shuffle" value="on" defaultChecked={values.shuffle} />
          Перемешивать вопросы у каждого ученика
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, color: "var(--ink-2)", fontSize: 13, marginTop: 8 }}>
          <input type="checkbox" name="allowRetake" value="on" defaultChecked={values.allowRetake} />
          Разрешить пройти заново
        </label>
      </div>
    </>
  );
}
