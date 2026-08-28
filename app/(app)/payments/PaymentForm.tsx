type StudentLite = { id: string; name: string };

export function PaymentForm({ students, fixedStudentId }: { students: StudentLite[]; fixedStudentId?: string }) {
  return (
    <>
      {fixedStudentId ? (
        <input type="hidden" name="studentId" value={fixedStudentId} />
      ) : (
        <div className="field">
          <label>Ученик *</label>
          <select name="studentId" required defaultValue="">
            <option value="" disabled>
              Выберите ученика
            </option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <label>Назначение</label>
        <input name="purpose" placeholder="Абонемент · 6 мес" defaultValue="Абонемент" />
      </div>
      <div className="grid2">
        <div className="field">
          <label>Сумма (₸) *</label>
          <input name="amount" type="number" required placeholder="90000" />
        </div>
        <div className="field">
          <label>Способ оплаты</label>
          <select name="method" defaultValue="Kaspi">
            <option>Kaspi</option>
            <option>Карта</option>
            <option>Наличные</option>
            <option>Перевод</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>Статус</label>
        <select name="status" defaultValue="PAID">
          <option value="PAID">Оплачено</option>
          <option value="PENDING">Ожидает оплаты</option>
          <option value="OVERDUE">Просрочен</option>
        </select>
      </div>
    </>
  );
}
