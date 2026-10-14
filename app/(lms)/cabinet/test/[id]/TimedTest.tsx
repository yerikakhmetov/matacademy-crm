"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { finishTestAttempt, saveTestAnswer } from "@/app/actions/tests";
import { Formula } from "@/components/Formula";
import { Icon } from "@/components/Icon";
import { t, type Locale } from "@/lib/i18n";

export type TimedQuestion = { id: string; index: number; textHtml: string; optionsHtml: string[] };

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function mmss(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Прохождение теста. Каждый ответ сразу уходит на сервер, поэтому закрытая вкладка
// или обновлённая страница не обнуляют работу. С таймером (deadlineIso) — когда время
// выйдет, результат посчитается по сохранённым ответам; без таймера (null) — только по «Сдать».
// «Сдать» всегда с подтверждением: «отвечено N из M».
export function TimedTest({
  testId,
  questions,
  initialAnswers,
  deadlineIso,
  locale,
  hint,
}: {
  testId: string;
  questions: TimedQuestion[];
  initialAnswers: number[];
  deadlineIso: string | null;
  locale: Locale;
  /** подсказка под панелью (без таймера: «попытка одна» / «можно пересдать») */
  hint?: string;
}) {
  const router = useRouter();
  const deadline = deadlineIso ? new Date(deadlineIso).getTime() : null;
  const [answers, setAnswers] = useState<number[]>(initialAnswers);
  const [left, setLeft] = useState(() => (deadline == null ? Infinity : deadline - Date.now()));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<Map<number, number>>(new Map()); // index -> выбор, который не сохранился
  const [confirming, setConfirming] = useState(false);
  const [, start] = useTransition();
  const finishing = useRef(false);
  // Ответы отправляются строго по очереди: сервер переписывает массив ответов целиком,
  // и два одновременных запроса затирали бы друг друга.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const finish = () => {
    if (finishing.current) return;
    finishing.current = true;
    start(async () => {
      await queue.current; // сначала дописать ответы, потом считать результат
      await finishTestAttempt(testId);
      router.refresh();
    });
  };

  useEffect(() => {
    if (deadline == null) return; // без таймера отсчёта нет
    const id = setInterval(() => {
      const ms = deadline - Date.now();
      setLeft(ms);
      if (ms <= 0) {
        clearInterval(id);
        finish();
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);

  const send = (index: number, choice: number) => {
    setSaving(true);
    queue.current = queue.current.then(async () => {
      try {
        await saveTestAnswer(testId, index, choice);
        setFailed((m) => {
          if (!m.has(index)) return m;
          const next = new Map(m);
          next.delete(index);
          return next;
        });
      } catch {
        setFailed((m) => new Map(m).set(index, choice));
      } finally {
        setSaving(false);
      }
    });
  };

  const choose = (index: number, choice: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = choice;
      return next;
    });
    send(index, choice);
  };

  const retryFailed = () => {
    for (const [index, choice] of failed) send(index, choice);
  };

  const answered = answers.filter((a) => a >= 0).length;
  const urgent = left < 60_000;

  return (
    <div>
      <div
        className="card"
        style={{
          padding: 14,
          marginBottom: 12,
          position: "sticky",
          top: 8,
          zIndex: 5,
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderColor: urgent ? "var(--bad)" : "var(--line)",
        }}
      >
        {deadline != null && (
          <div
            className="num"
            role="timer"
            aria-label={t(locale, "test.timeLeft")}
            style={{ fontSize: 22, fontWeight: 800, color: urgent ? "var(--bad)" : "var(--ink)" }}
          >
            {urgent && <span aria-hidden="true">⏱ </span>}
            {mmss(left)}
          </div>
        )}
        <div className="mut" style={{ fontSize: 12.5, flex: 1, minWidth: 0 }}>
          {t(locale, "test.answeredOf", { n: answered, total: questions.length })}
          {saving ? ` · ${t(locale, "test.saving")}` : ""}
        </div>
        {!confirming && (
          <button className="btn" type="button" onClick={() => setConfirming(true)}>
            <Icon name="check" size={16} />
            {t(locale, "test.submit")}
          </button>
        )}
      </div>

      {hint && !confirming && (
        <p className="mut" style={{ fontSize: 12, margin: "-4px 2px 12px" }}>{hint}</p>
      )}

      {confirming && (
        <div className="card" role="alertdialog" aria-live="assertive" style={{ padding: 14, marginBottom: 12, borderColor: "var(--accent)" }}>
          <p style={{ margin: "0 0 10px", fontWeight: 600 }}>
            {t(locale, "test.confirmSubmit", { n: answered, total: questions.length })}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" type="button" onClick={finish}>
              {t(locale, "test.confirmYes")}
            </button>
            <button className="btn ghost" type="button" onClick={() => setConfirming(false)}>
              {t(locale, "test.confirmNo")}
            </button>
          </div>
        </div>
      )}

      {failed.size > 0 && (
        <div className="err" role="alert" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ flex: 1 }}>{t(locale, "test.saveFailed", { n: failed.size })}</span>
          <button className="btn" type="button" onClick={retryFailed}>
            {t(locale, "test.retrySave")}
          </button>
        </div>
      )}

      {questions.map((q, shown) => (
        <div key={q.id} className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>{shown + 1}. <Formula html={q.textHtml} /></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {q.optionsHtml.map((optHtml, oi) => {
              const active = answers[q.index] === oi;
              return (
                <label
                  key={oi}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 12px",
                    minHeight: 48,
                    borderRadius: 9,
                    border: `1.5px solid ${active ? "var(--accent)" : "var(--line-2)"}`,
                    background: active ? "var(--accent-soft)" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name={`q_${q.id}`}
                    checked={active}
                    onChange={() => choose(q.index, oi)}
                  />
                  <span className="num" style={{ fontWeight: 700, width: 18 }}>{LETTERS[oi]}</span>
                  <span style={{ flex: 1 }}><Formula html={optHtml} /></span>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <p className="mut" style={{ fontSize: 12, textAlign: "center" }}>
        {t(locale, "test.autosaveNote")}
      </p>
    </div>
  );
}
