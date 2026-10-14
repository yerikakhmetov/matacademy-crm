"use client";

import { useState, useTransition } from "react";
import { remindTestPending } from "@/app/actions/tests";
import { Icon } from "@/components/Icon";

// «Напомнить в Telegram» тем, кто ещё не сдал тест. С подтверждением: рассылка уходит
// родителям сразу, отменить её нельзя.
export function RemindPendingButton({ testId, pending }: { testId: string; pending: number }) {
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  const send = () =>
    start(async () => {
      const r = await remindTestPending(testId);
      setConfirming(false);
      if (r.error) setResult(r.error);
      else if (!r.students) setResult("Некому напоминать: тест ещё не открылся или все сдали.");
      else
        setResult(
          r.sent
            ? `Отправлено сообщений: ${r.sent} (учеников без теста: ${r.students}).`
            : `Учеников без теста: ${r.students}, но ни у кого из них не подключён Telegram — напомните по WhatsApp.`
        );
    });

  if (confirming) {
    return (
      <div role="alertdialog" aria-live="assertive" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Отправить напоминание {pending} ученикам и их родителям?</span>
        <button className="btn" type="button" disabled={isPending} onClick={send}>
          {isPending ? "Отправляем…" : "Да, отправить"}
        </button>
        <button className="btn ghost" type="button" disabled={isPending} onClick={() => setConfirming(false)}>
          Отмена
        </button>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button
        className="btn ghost"
        type="button"
        onClick={() => {
          setResult(null);
          setConfirming(true);
        }}
      >
        <Icon name="bell" size={15} />
        Напомнить в Telegram
      </button>
      {result && (
        <span role="status" className="mut" style={{ fontSize: 12.5 }}>
          {result}
        </span>
      )}
    </div>
  );
}
