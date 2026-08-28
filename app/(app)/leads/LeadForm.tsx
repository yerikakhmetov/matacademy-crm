export function LeadForm() {
  return (
    <>
      <div className="field">
        <label>Контакт (родитель) *</label>
        <input name="name" required placeholder="Айдана (мама Санжара)" />
      </div>
      <div className="grid2">
        <div className="field">
          <label>Имя ребёнка</label>
          <input name="childName" placeholder="Санжар" />
        </div>
        <div className="field">
          <label>Класс</label>
          <input name="grade" placeholder="8 класс" />
        </div>
      </div>
      <div className="grid2">
        <div className="field">
          <label>Предмет / интерес</label>
          <input name="subject" placeholder="Алгебра" />
        </div>
        <div className="field">
          <label>Телефон</label>
          <input name="phone" placeholder="+7 701 …" />
        </div>
      </div>
      <div className="field">
        <label>Источник</label>
        <select name="source" defaultValue="Instagram">
          <option>Instagram</option>
          <option>2ГИС</option>
          <option>Сайт</option>
          <option>Реклама</option>
          <option>Рекомендация</option>
          <option>Другое</option>
        </select>
      </div>
    </>
  );
}
