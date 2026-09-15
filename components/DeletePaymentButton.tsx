"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePayment } from "@/app/actions/data";

// Удаление ошибочной оплаты. Вместе со счётом удаляются и принятые по нему деньги,
// поэтому они пропадут из дохода месяца — об этом предупреждаем прямо в вопросе.
export function DeletePaymentButton({ paymentId, paidAmount }: { paymentId: string; paidAmount: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = () => {
    const warn =
      paidAmount > 0
        ? `Оплата удалится вместе с принятыми деньгами — ${paidAmount.toLocaleString("ru-RU")} ₸ пропадут из дохода.\n\nУдаляйте только ошибочную запись. Если деньги реально вернули, оформите «Возврат».\n\nУдалить?`
        : "Удалить счёт?";
    if (!confirm(warn)) return;
    start(async () => {
      await deletePayment(paymentId);
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      className="btn ghost"
      onClick={run}
      disabled={pending}
      style={{ padding: "5px 11px", fontSize: 12.5, color: "var(--bad)" }}
    >
      {pending ? "Удаляем…" : "Удалить"}
    </button>
  );
}
