export function RateForm({ rate, rateType }: { rate: number; rateType: string }) {
  return (
    <>
      <div className="field">
        <label>Тип оплаты</label>
        <select name="rateType" defaultValue={rateType}>
          <option value="PER_LESSON">За урок (₸ за каждый проведённый урок)</option>
          <option value="PER_STUDENT">За ученика (₸ за каждого ученика в месяц)</option>
          <option value="PERCENT">% от оплат его учеников</option>
        </select>
      </div>
      <div className="field">
        <label>Ставка</label>
        <input name="rate" type="number" defaultValue={rate} placeholder="напр. 3000 или 40" />
        <p className="mut" style={{ fontSize: 12, margin: 0 }}>
          Для «% от оплат» укажите процент (например 40), для остальных — сумму в тенге.
        </p>
      </div>
    </>
  );
}
