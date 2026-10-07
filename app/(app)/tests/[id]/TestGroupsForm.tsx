"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTestGroups } from "@/app/actions/data";

type Group = { id: string; name: string; opensAt: string | null };

// Кому назначен тест. Каждая группа открывает его после своего урока
// в день теста, поэтому рядом показано время открытия.
export function TestGroupsForm({
  testId,
  all,
  selected,
  primaryId,
  canEdit,
}: {
  testId: string;
  all: Group[];
  selected: string[];
  primaryId: string | null;
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!canEdit) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {all
          .filter((g) => selected.includes(g.id))
          .map((g) => (
            <span key={g.id} className="chip c-mut">
              <span className="d" />
              {g.name}
              {g.opensAt ? ` · ${g.opensAt}` : ""}
            </span>
          ))}
      </div>
    );
  }

  return (
    <form
      action={(fd) => start(async () => { await setTestGroups(testId, fd); router.refresh(); })}
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {all.map((g) => (
          <label
            key={g.id}
            className={`chip ${selected.includes(g.id) ? "c-ok" : "c-mut"}`}
            style={{ cursor: g.id === primaryId ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px" }}
            title={g.id === primaryId ? "Основная группа — всегда в списке" : g.opensAt ? `Откроется ${g.opensAt}` : undefined}
          >
            <input
              type="checkbox"
              name="groupIds"
              value={g.id}
              defaultChecked={selected.includes(g.id)}
              disabled={g.id === primaryId}
            />
            {g.name}
            {g.opensAt && selected.includes(g.id) ? <span className="mut" style={{ fontSize: 11 }}>{g.opensAt}</span> : null}
          </label>
        ))}
      </div>
      <div>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Сохраняем…" : "Сохранить группы"}
        </button>
      </div>
    </form>
  );
}
