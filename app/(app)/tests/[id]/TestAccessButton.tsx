"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTestAccess } from "@/app/actions/data";
import { Icon } from "@/components/Icon";

// Доступ к тесту: по умолчанию он открывается после урока в день теста.
// Если тест завели задним числом или для прошедшего урока, это правило держит
// его закрытым — тогда доступ открывают вручную.
export function TestAccessButton({ testId, manual, open }: { testId: string; manual: boolean; open: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const toggle = (next: boolean) =>
    start(async () => {
      await setTestAccess(testId, next);
      router.refresh();
    });

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <span className={`chip ${open ? "c-ok" : "c-warn"}`}>
        <span className="d" />
        {open ? "Доступен ученикам" : "Закрыт"}
        {manual ? " · вручную" : " · по расписанию"}
      </span>
      {manual ? (
        <button className="btn ghost" type="button" disabled={pending} onClick={() => toggle(false)}>
          {pending ? "…" : "Вернуть по расписанию"}
        </button>
      ) : (
        <button className="btn ghost" type="button" disabled={pending} onClick={() => toggle(true)}>
          <Icon name="check" size={15} />
          {pending ? "Открываем…" : "Открыть доступ сейчас"}
        </button>
      )}
    </div>
  );
}
