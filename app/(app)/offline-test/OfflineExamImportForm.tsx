"use client";

import { useActionState } from "react";
import { importOfflineExamAccess, type OfflineExamImportState } from "@/app/actions/offline-exam";

const initial: OfflineExamImportState = {};

export function OfflineExamImportForm() {
  const [state, action, pending] = useActionState(importOfflineExamAccess, initial);
  return (
    <form action={action} className="card" style={{ padding: 22, display: "grid", gap: 16, maxWidth: 640 }}>
      <label style={{ display: "grid", gap: 6 }}>
        <span>Тест атауы</span>
        <input name="title" required maxLength={100} defaultValue="Математика · №1Б" />
      </label>
      <label style={{ display: "grid", gap: 6 }}>
        <span>Оқушылар ашатын жергілікті сілтеме</span>
        <input name="url" type="url" required placeholder="http://192.168.8.125:4173" />
      </label>
      <label style={{ display: "grid", gap: 6 }}>
        <span>Оқушының аты-жөні, телефоны және құпия сөзі бар CSV</span>
        <input name="credentials" type="file" accept=".csv,text/csv" required />
      </label>
      <p className="mut" style={{ margin: 0, fontSize: 13 }}>
        Жүйе әр жолды CRM-дегі белсенді оқушының телефоны, аты және тобымен салыстырады. Сәйкес келмесе, ешбір құпия сөз жарияланбайды.
      </p>
      {state.error && <p role="alert" style={{ color: "var(--bad)", margin: 0 }}>{state.error}</p>}
      {state.imported != null && <p role="status" style={{ color: "var(--ok)", margin: 0 }}>
        {state.imported} оқушының кабинетіне сілтеме мен құпия сөз енгізілді. {state.linked} оқушының CRM кабинеті Telegram-ға тіркелген.
      </p>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Жүктеліп жатыр…" : "Жеке кабинеттерге енгізу"}</button>
    </form>
  );
}
