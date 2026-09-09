"use client";

import { useMemo, useState } from "react";
import { parseTestSource } from "@/lib/test-import";

const LETTERS = "ABCD";

// Обновление вопросов существующего теста из того же LaTeX-исходника.
// Показываем, сходится ли количество вопросов: если тест уже проходили,
// менять их число нельзя — ответы в работах хранятся по номеру вопроса.
export function RefreshQuestionsForm({ current, attempts }: { current: number; attempts: number }) {
  const [src, setSrc] = useState("");
  const parsed = useMemo(() => (src.trim() ? parseTestSource(src) : null), [src]);
  const countMismatch = parsed != null && current > 0 && parsed.questions.length !== current;
  const blocked = countMismatch && attempts > 0;

  return (
    <>
      <p className="mut" style={{ fontSize: 12.5, marginTop: 0 }}>
        Вставьте тот же исходник, из которого делали тест. Условия и варианты перезапишутся, формулы начнут
        набираться. Оценки и работы учеников сохранятся{attempts > 0 ? " и будут пересчитаны" : ""}.
      </p>

      <div className="field">
        <label>Исходник (LaTeX)</label>
        <textarea
          name="source"
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          rows={9}
          placeholder={"\\item $\\dfrac{3}{10}+\\dfrac{4}{10}=$\n\\choices{...}{...}{...}{...}\n…\nЖауаптары\n1. B & 2. A"}
          style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, resize: "vertical" }}
        />
      </div>

      {parsed && (
        <div style={{ borderTop: "1px solid var(--line-2)", paddingTop: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <span className={`chip ${parsed.questions.length > 0 ? "c-ok" : "c-bad"}`}>
              <span className="d" />
              В исходнике: {parsed.questions.length}
            </span>
            <span className="chip c-mut">
              <span className="d" />
              Сейчас в тесте: {current}
            </span>
            {attempts > 0 && (
              <span className="chip c-warn">
                <span className="d" />
                Уже прошли: {attempts}
              </span>
            )}
          </div>

          {blocked && (
            <div className="err" style={{ marginTop: 0 }}>
              Количество вопросов не совпадает, а тест уже проходили — сохранить нельзя. Исправьте исходник, чтобы
              вопросов было {current}.
            </div>
          )}
          {countMismatch && attempts === 0 && (
            <div className="mut" style={{ fontSize: 12, color: "var(--warn)", marginBottom: 8 }}>
              Количество вопросов изменится: {current} → {parsed.questions.length}. Так можно, тест ещё никто не проходил.
            </div>
          )}

          {parsed.warnings.map((w, i) => (
            <div key={i} className="mut" style={{ fontSize: 12, color: "var(--warn)", marginBottom: 4 }}>
              {w}
            </div>
          ))}

          {parsed.questions.slice(0, 2).map((q, i) => (
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
        </div>
      )}
    </>
  );
}
