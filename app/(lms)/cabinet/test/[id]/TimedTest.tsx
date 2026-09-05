"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { finishTestAttempt, saveTestAnswer } from "@/app/actions/data";
import { Icon } from "@/components/Icon";
import { t, type Locale } from "@/lib/i18n";

export type TimedQuestion = { id: string; index: number; text: string; options: string[] };

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function mmss(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Тест с ограничением по времени. Каждый ответ сразу уходит на сервер,
// поэтому закрытая вкладка не обнуляет работу: когда время выйдет,
// результат посчитается по сохранённым ответам.
export function TimedTest({
  testId,
  questions,
  initialAnswers,
  deadlineIso,
  locale,
}: {
  testId: string;
  questions: TimedQuestion[];
  initialAnswers: number[];
  deadlineIso: string;
  locale: Locale;
}) {
  const router = useRouter();
  const deadline = new Date(deadlineIso).getTime();
  const [answers, setAnswers] = useState<number[]>(initialAnswers);
  const [left, setLeft] = useState(() => deadline - Date.now());
  const [saving, setSaving] = useState(false);
  const [, start] = useTransition();
  const finishing = useRef(false);

  const finish = () => {
    if (finishing.current) return;
    finishing.current = true;
    start(async () => {
      await finishTestAttempt(testId);
      router.refresh();
    });
  };

  useEffect(() => {
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

  const choose = (index: number, choice: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = choice;
      return next;
    });
    setSaving(true);
    start(async () => {
      await saveTestAnswer(testId, index, choice);
      setSaving(false);
    });
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
        <div className="num" style={{ fontSize: 22, fontWeight: 800, color: urgent ? "var(--bad)" : "var(--ink)" }}>
          {mmss(left)}
        </div>
        <div className="mut" style={{ fontSize: 12.5, flex: 1 }}>
          {t(locale, "test.answeredOf", { n: answered, total: questions.length })}
          {saving ? ` · ${t(locale, "test.saving")}` : ""}
        </div>
        <button className="btn" type="button" onClick={finish}>
          <Icon name="check" size={16} />
          {t(locale, "test.submit")}
        </button>
      </div>

      {questions.map((q, shown) => (
        <div key={q.id} className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>{shown + 1}. {q.text}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {q.options.map((opt, oi) => {
              const active = answers[q.index] === oi;
              return (
                <label
                  key={oi}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
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
                  <span style={{ flex: 1 }}>{opt}</span>
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
