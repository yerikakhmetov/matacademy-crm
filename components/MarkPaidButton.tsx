"use client";

import { useTransition } from "react";
import { markPaid } from "@/app/actions/data";
import { Icon } from "./Icon";

export function MarkPaidButton({ paymentId }: { paymentId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn ghost"
      type="button"
      style={{ padding: "5px 11px", fontSize: 12.5 }}
      disabled={pending}
      onClick={() => start(() => markPaid(paymentId))}
      title="Отметить оплаченным"
    >
      <Icon name="check" size={14} />
      {pending ? "…" : "Оплачено"}
    </button>
  );
}
