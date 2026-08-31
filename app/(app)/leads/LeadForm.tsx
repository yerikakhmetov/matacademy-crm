type Values = {
  name?: string;
  childName?: string | null;
  grade?: string | null;
  subject?: string | null;
  phone?: string | null;
  source?: string | null;
  trialDate?: Date | null;
  nextActionAt?: Date | null;
};

const dateVal = (d?: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export function LeadForm({ values }: { values?: Values }) {
  return (
    <>
      <div className="field">
        <label>Контакт (родитель) *</label>
        <input name="name" required placeholder="Айдана (мама Санжара)" defaultValue={values?.name ?? ""} />
      </div>
      <div className="grid2">
        <div className="field">
          <label>Имя ребёнка</label>
          <input name="childName" placeholder="Санжар" defaultValue={values?.childName ?? ""} />
        </div>
        <div className="field">
          <label>Класс</label>
          <input name="grade" placeholder="8 класс" defaultValue={values?.grade ?? ""} />
        </div>
      </div>
      <div className="grid2">
        <div className="field">
          <label>Предмет / интерес</label>
          <input name="subject" placeholder="Алгебра" defaultValue={values?.subject ?? ""} />
        </div>
        <div className="field">
          <label>Телефон</label>
          <input name="phone" placeholder="+7 701 …" defaultValue={values?.phone ?? ""} />
        </div>
      </div>
      <div className="field">
        <label>Источник</label>
        <select name="source" defaultValue={values?.source ?? "Instagram"}>
          <option>Instagram</option>
          <option>2ГИС</option>
          <option>Сайт</option>
          <option>Реклама</option>
          <option>Рекомендация</option>
          <option>Другое</option>
        </select>
      </div>
      <div className="grid2">
        <div className="field">
          <label>Пробный урок</label>
          <input name="trialDate" type="date" defaultValue={dateVal(values?.trialDate)} />
        </div>
        <div className="field">
          <label>Следующее действие</label>
          <input name="nextActionAt" type="date" defaultValue={dateVal(values?.nextActionAt)} />
        </div>
      </div>
    </>
  );
}
