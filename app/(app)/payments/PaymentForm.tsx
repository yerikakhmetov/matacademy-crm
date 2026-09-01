type StudentLite = { id: string; name: string };
type Subject = { id: string; name: string; color: string };

export function PaymentForm({ students, fixedStudentId, subjects = [] }: { students: StudentLite[]; fixedStudentId?: string; subjects?: Subject[] }) {
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
            <option>Халық банк</option>
            <option>Карта</option>
            <option>Наличные</option>
            <option>Перевод</option>
          </select>
        </div>
      </div>
      {subjects.length > 0 && (
        <div className="field">
          <label>За какие предметы (сумма делится пропорционально цене)</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {subjects.map((s) => (
              <label
                key={s.id}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 11px", borderRadius: 20, border: "1.5px solid var(--line-2)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
              >
                <input type="checkbox" name="subjects" value={s.id} />
                <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />
                {s.name}
              </label>
            ))}
          </div>
          <p className="mut" style={{ fontSize: 11.5, margin: "6px 0 0" }}>
            Не обязательно. Если отметить — платёж попадёт в «Доход по предметам» и в зарплату «% от дохода по предметам».
          </p>
        </div>
      )}
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
