"use client";

import { useMemo, useState } from "react";
import { parseTestSource } from "@/lib/test-import";

const LETTERS = "ABCD";

// Импорт теста из LaTeX: тот же разбор, что и на сервере, показывает предпросмотр,
// чтобы преподаватель увидел, как вопросы будут выглядеть у ученика.
export function ImportForm({
  groups,
  subjects,
}: {
  groups: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
}) {
  const [src, setSrc] = useState("");
  const parsed = useMemo(() => (src.trim() ? parseTestSource(src) : null), [src]);

  return (
    <>
      <div className="field">
        <label>Исходник (LaTeX)</label>
        <textarea
          name="source"
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          rows={8}
          placeholder={"\\item $\\dfrac{3}{10}+\\dfrac{4}{10}=$\n\\choices{\\dfrac{1}{10}}{\\dfrac{7}{10}}{\\dfrac{3}{5}}{\\dfrac{4}{5}}\n…\nЖауаптары\n1. B & 2. A"}
          style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, resize: "vertical" }}
        />
        <p className="mut" style={{ fontSize: 12, marginTop: 4 }}>
          Вопросы вида <code>\item $…$</code> + <code>{"\\choices{}{}{}{}"}</code>, ниже таблица ответов после слова
          «Жауаптары»: <code>1. B &amp; 2. A</code>.
        </p>
      </div>

      <div className="field">
        <label>Название теста</label>
        <input name="title" defaultValue="" placeholder={parsed?.title || "Например: Бөлшектерге амалдар қолдану"} />
        {parsed?.title && (
          <p className="mut" style={{ fontSize: 12, marginTop: 4 }}>
            Пусто — возьмём из исходника: «{parsed.title}»
          </p>
        )}
      </div>

      <div className="grid2">
        <div className="field">
          <label>Группа</label>
          <select name="groupId" defaultValue="">
            <option value="">Без группы</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Предмет</label>
          <select name="subjectId" defaultValue="">
            <option value="">Не указан</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label>Ограничение по времени, мин</label>
          <input name="timeLimitMin" type="number" min={0} placeholder="без ограничения" />
        </div>
        <div className="field">
          <label>Дата</label>
          <input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>
        <input type="checkbox" name="shuffle" value="on" />
        Перемешивать вопросы каждому ученику
      </label>

      {parsed && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--line-2)", paddingTop: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <span className={`chip ${parsed.questions.length > 0 ? "c-ok" : "c-bad"}`}>
              <span className="d" />
              Вопросов: {parsed.questions.length}
            </span>
            {parsed.warnings.length > 0 && (
              <span className="chip c-warn">
                <span className="d" />
                Замечаний: {parsed.warnings.length}
              </span>
            )}
          </div>

          {parsed.warnings.map((w, i) => (
            <div key={i} className="mut" style={{ fontSize: 12, color: "var(--warn)", marginBottom: 4 }}>
              {w}
            </div>
          ))}

          {parsed.questions.slice(0, 3).map((q, i) => (
            <div key={i} style={{ fontSize: 12.5, marginTop: 8 }}>
              <div style={{ fontWeight: 600 }}>{i + 1}. {q.text}</div>
              <div className="mut">
                {q.options.map((o, j) => (
                  <span key={j} style={{ marginRight: 12, color: j === q.correct ? "var(--ok)" : undefined, fontWeight: j === q.correct ? 700 : 400 }}>
                    {LETTERS[j]}) {o}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {parsed.questions.length > 3 && (
            <div className="mut" style={{ fontSize: 12, marginTop: 8 }}>
              …и ещё {parsed.questions.length - 3}. Зелёным отмечен верный вариант.
            </div>
          )}
        </div>
      )}
    </>
  );
}
