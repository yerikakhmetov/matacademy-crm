export function HomeworkForm() {
  return (
    <>
      <div className="field">
        <label>Задание *</label>
        <input name="title" required placeholder="§14, № 5–12" />
      </div>
      <div className="field">
        <label>Описание</label>
        <input name="description" placeholder="Повторить формулы, решить примеры" />
      </div>
      <div className="field">
        <label>Срок сдачи</label>
        <input name="dueDate" type="date" />
      </div>
    </>
  );
}
