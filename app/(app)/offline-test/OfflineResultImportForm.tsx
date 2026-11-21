"use client";

import { useActionState } from "react";
import { importOfflineExamResults, type OfflineResultImportState } from "@/app/actions/offline-exam";

const initial: OfflineResultImportState = {};
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Almaty" });

export function OfflineResultImportForm() {
  const [state, action, pending] = useActionState(importOfflineExamResults, initial);
  return (
    <form action={action} className="card" style={{ padding: 22, display: "grid", gap: 16, maxWidth: 640 }}>
      <h2 style={{ margin: 0 }}>Аяқталған тест нәтижелері</h2>
      <label style={{ display: "grid", gap: 6 }}>
        <span>Тест атауы</span>
        <input name="title" required maxLength={100} defaultValue="Математика · офлайн тест" />
      </label>
      <label style={{ display: "grid", gap: 6 }}>
        <span>Тест кілті (осы тестті қайта жүктегенде өзгермейді)</span>
        <input name="examKey" required minLength={8} maxLength={80} pattern="[a-z0-9-]+" defaultValue={`math-${today}-1`} />
      </label>
      <label style={{ display: "grid", gap: 6 }}>
        <span>Тест күні</span>
        <input name="date" type="date" required defaultValue={today} />
      </label>
      <label style={{ display: "grid", gap: 6 }}>
        <span>Мұғалім панелінен жүктелген «Нәтижені жүктеу» CSV файлы</span>
        <input name="results" type="file" accept=".csv,text/csv" required />
      </label>
      <p className="mut" style={{ margin: 0, fontSize: 13 }}>
        Тек тестке кірген оқушылардың ұпайы енгізіледі. Телефон мен аты-жөні CRM жазбасымен сәйкес болуы керек. Бір тестті қайта жүктеу қайталанған баға жасамайды.
      </p>
      {state.error && <p role="alert" style={{ color: "var(--bad)", margin: 0 }}>{state.error}</p>}
      {state.imported != null && <p role="status" style={{ color: "var(--ok)", margin: 0 }}>
        {state.imported} оқушының нәтижесі сақталды. {state.linked} оқушының CRM кабинеті Telegram-ға тіркелген.
      </p>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Сақталып жатыр…" : "Нәтижелерді кабинеттерге сақтау"}</button>
    </form>
  );
}
