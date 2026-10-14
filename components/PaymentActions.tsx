import Link from "next/link";
import { ModalButton } from "@/components/ModalButton";
import { MarkPaidButton } from "@/components/MarkPaidButton";
import { DeletePaymentButton } from "@/components/DeletePaymentButton";
import { RowMenu } from "@/components/RowMenu";
import { Icon } from "@/components/Icon";
import { receivePaymentForm, refundPayment } from "@/app/actions/payments";
import { money, PAYMENT_METHODS } from "@/lib/format";

// Действия по счёту в строке таблицы: одно главное действие на виду («Оплачено», а у
// закрытого счёта — «Квитанция»), остальное — в меню «⋯», «Удалить» — последним.
// edit — окно «Изменить»: у страниц оплат и карточки ученика оно своё.
export function PaymentActions({
  paymentId,
  amount,
  paidAmount,
  refundedAmount,
  edit,
}: {
  paymentId: string;
  amount: number;
  paidAmount: number;
  refundedAmount: number;
  edit?: React.ReactNode;
}) {
  const left = Math.max(0, amount - paidAmount);
  const refundable = Math.max(0, paidAmount - refundedAmount);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="row-actions">
      {left > 0 ? (
        <MarkPaidButton paymentId={paymentId} />
      ) : paidAmount >= amount ? (
        <Link className="btn ghost" href={`/receipt/${paymentId}`} style={{ padding: "5px 11px", fontSize: 12.5 }}>
          <Icon name="export" size={14} />
          Квитанция
        </Link>
      ) : null}
      <RowMenu>
      {edit}
      {left > 0 && (
        <ModalButton
          label="Принять частично"
          title="Принять часть оплаты"
          icon="money"
          buttonClass="btn ghost"
          action={receivePaymentForm.bind(null, paymentId)}
          submitLabel="Принять"
        >
          <p className="mut" style={{ fontSize: 13, margin: "0 0 12px" }}>
            Остаток по счёту: <b>{money(left)}</b>. Введите, сколько принесли сейчас — остальное останется долгом.
          </p>
          <div className="grid2">
            <div className="field">
              <label>Сумма (₸)</label>
              <input name="amount" type="number" min={1} max={left} defaultValue={left} required />
            </div>
            <div className="field">
              <label>Способ</label>
              <select name="method" defaultValue="">
                <option value="">Не указан</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Дата поступления</label>
            <input name="date" type="date" defaultValue={today} />
          </div>
        </ModalButton>
      )}
      {refundable > 0 && (
        <ModalButton
          label="Возврат"
          title="Возврат денег"
          icon="money"
          buttonClass="btn ghost"
          action={refundPayment.bind(null, paymentId)}
          submitLabel="Вернуть"
        >
          <p className="mut" style={{ fontSize: 13, margin: "0 0 12px" }}>
            По счёту получено <b>{money(refundable)}</b>. Возврат уменьшит доход того месяца, в котором сделан.
          </p>
          <div className="grid2">
            <div className="field">
              <label>Сумма (₸)</label>
              <input name="amount" type="number" min={1} max={refundable} defaultValue={refundable} required />
            </div>
            <div className="field">
              <label>Дата возврата</label>
              <input name="date" type="date" defaultValue={today} />
            </div>
          </div>
          <div className="field">
            <label>Причина</label>
            <input name="note" placeholder="Например: отказ от обучения" />
          </div>
        </ModalButton>
      )}
      <DeletePaymentButton paymentId={paymentId} paidAmount={paidAmount} />
      </RowMenu>
    </div>
  );
}
