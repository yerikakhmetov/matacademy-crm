"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTestGroups } from "@/app/actions/data";

type Group = {
  id: string;
  name: string;
  opensAt: string | null; // когда откроется (в часовом поясе школы)
  date: string; // YYYY-MM-DD — день теста для этой группы
  ownDate: boolean; // дата задана именно для группы, а не общая
};

// Кому назначен тест и в какой день каждая группа его проходит.
// Группы проходят одну работу в разные дни, поэтому у каждой свой день;
// открывается тест после урока группы в этот день.
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
  const [checked, setChecked] = useState<Set<string>>(new Set(selected));
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

  const toggle = (id: string) =>
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <form
      action={(fd) => start(async () => { await setTestGroups(testId, fd); router.refresh(); })}
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Группа</th>
              <th>День теста</th>
              <th>Откроется</th>
            </tr>
          </thead>
          <tbody>
            {all.map((g) => {
              const on = checked.has(g.id);
              const primary = g.id === primaryId;
              return (
                <tr key={g.id} style={{ opacity: on ? 1 : 0.55 }}>
                  <td>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: primary ? "default" : "pointer", fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        name="groupIds"
                        value={g.id}
                        checked={on}
                        disabled={primary}
                        onChange={() => toggle(g.id)}
                      />
                      {g.name}
                      {primary && <span className="chip c-mut" style={{ fontSize: 10.5 }}>основная</span>}
                    </label>
                    {/* отключённый чекбокс не отправляется — основную группу шлём отдельно */}
                    {primary && <input type="hidden" name="groupIds" value={g.id} />}
                  </td>
                  <td>
                    <input
                      type="date"
                      name={`date_${g.id}`}
                      defaultValue={g.date}
                      disabled={!on}
                      title={g.ownDate ? "Свой день для этой группы" : "Общая дата теста — можно поменять для группы"}
                    />
                  </td>
                  <td className="mut num" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
                    {on ? (g.opensAt ?? "после сохранения") : "—"}
                  </td>
                </tr>
              );
            })}
            {all.length === 0 && (
              <tr><td colSpan={3}><div className="empty">Групп пока нет</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Сохраняем…" : "Сохранить группы и даты"}
        </button>
      </div>
    </form>
  );
}
