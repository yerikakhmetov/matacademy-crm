"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveAttendance, setLessonCancelled } from "@/app/actions/data";
import { initials, avatarColor } from "@/lib/format";
import { Icon } from "@/components/Icon";

type AttState = "present" | "excused" | "unexcused";
type Fault = "SCHOOL" | "TEACHER" | "OTHER";

// Чья сторона сорвала занятие. От этого зависит зарплата: по вине преподавателя
// день остаётся в делителе, то есть за него не платят.
const FAULTS: { key: Fault; label: string; hint: string }[] = [
  { key: "SCHOOL", label: "Праздник, школа, форс-мажор", hint: "день не входит в расчёт — зарплата преподавателя не уменьшается" },
  { key: "TEACHER", label: "По вине преподавателя", hint: "за это занятие преподавателю не платят" },
  { key: "OTHER", label: "Другая причина", hint: "день не входит в расчёт зарплаты" },
];
type S = { id: string; name: string; grade: string | null; state: AttState };

const STATES: { key: AttState; label: string; cls: string }[] = [
  { key: "present", label: "Был", cls: "c-ok" },
  { key: "excused", label: "Уваж.", cls: "c-mut" },
  { key: "unexcused", label: "Н/ув", cls: "c-bad" },
];

export function AttendanceForm({
  lessonId,
  date,
  students,
  editor,
  canCancel,
  marked,
  weekday,
  topic,
  cancelled,
  cancelReason,
  cancelFault,
}: {
  lessonId: string;
  date: string;
  students: S[];
  editor: boolean;
  /** отмена занятия влияет на зарплату, поэтому доступна не всем, кто отмечает посещаемость */
  canCancel: boolean;
  marked: boolean;
  weekday: number;
  topic: string;
  cancelled: boolean;
  cancelReason: string;
  /** "TEACHER" — сорвано по вине преподавателя, день остаётся в делителе зарплаты */
  cancelFault: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  // локальное состояние отметок
  const [state, setState] = useState<Record<string, AttState>>(
    Object.fromEntries(students.map((s) => [s.id, s.state]))
  );

  const presentCount = Object.values(state).filter((v) => v === "present").length;

  function changeDate(newDate: string) {
    router.push(`/schedule/${lessonId}?date=${newDate}`);
  }

  // Форма отмены: причина влияет на зарплату, поэтому спрашиваем не только текст,
  // но и чья это сторона — по вине преподавателя день остаётся в делителе.
  const [cancelOpen, setCancelOpen] = useState(false);
  const [fault, setFault] = useState<Fault>("SCHOOL");
  const [reason, setReason] = useState("");

  function confirmCancel() {
    start(async () => {
      await setLessonCancelled(lessonId, date, true, reason, fault);
      setCancelOpen(false);
      setReason("");
      router.refresh();
    });
  }

  function restoreLesson() {
    start(async () => {
      await setLessonCancelled(lessonId, date, false, "");
      router.refresh();
    });
  }

  const allPresent = () => setState(Object.fromEntries(students.map((s) => [s.id, "present" as AttState])));

  function submit(formData: FormData) {
    start(async () => {
      await saveAttendance(lessonId, date, formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="two-col">
      {cancelled ? (
        <div className="card">
          <div className="card-h">
            <h3>Посещаемость</h3>
            <span className="chip c-bad"><span className="d" />Занятие отменено</span>
          </div>
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🚫</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Занятие не состоялось</div>
            <p className="mut" style={{ fontSize: 13, margin: "0 0 4px" }}>
              {cancelReason || "Причина не указана"}
            </p>
            <p style={{ margin: "0 0 8px" }}>
              <span className={`chip ${cancelFault === "TEACHER" ? "c-bad" : "c-mut"}`}>
                <span className="d" />
                {FAULTS.find((f) => f.key === cancelFault)?.label ?? "Причина не указана"}
              </span>
            </p>
            <p className="mut" style={{ fontSize: 12, margin: "0 0 16px" }}>
              {cancelFault === "TEACHER"
                ? "День остаётся в расчёте зарплаты: за это занятие преподавателю не начисляется."
                : "Этот день не входит в расчёт зарплаты, отметки посещаемости за него удалены."}
            </p>
            {canCancel && (
              <button className="btn" type="button" onClick={restoreLesson} disabled={pending}>
                <Icon name="check" size={15} />
                {pending ? "Отмечаем…" : "Занятие состоялось"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <form action={submit} className="card">
          <div className="card-h">
            <h3>Посещаемость</h3>
            <span className={`chip ${marked ? "c-ok" : "c-mut"}`}>
              <span className="d" />
              {marked ? "Отмечено" : "Не отмечено"}
            </span>
          </div>

          {/* Занятие состоялось или нет — это решает зарплату, поэтому вынесено наверх */}
          {canCancel && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderBottom: "1px solid var(--line-2)", flexWrap: "wrap" }}>
              <span className="mut" style={{ fontSize: 12.5 }}>Занятие:</span>
              <span className="chip c-ok"><span className="d" />Состоялось</span>
              <button
                className="btn ghost"
                type="button"
                onClick={() => setCancelOpen((v) => !v)}
                disabled={pending}
                style={{ padding: "4px 10px", fontSize: 12, color: "var(--bad)" }}
              >
                Не состоялось
              </button>
            </div>
          )}

          <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line-2)" }}>
            <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ink-3)", fontWeight: 700, marginBottom: 6 }}>
              Тема урока
            </label>
            <input
              name="topic"
              defaultValue={topic}
              disabled={!editor}
              placeholder="Что проходили на занятии"
              style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 9, padding: "9px 12px" }}
            />
          </div>

          {students.length === 0 && <div className="empty">В группе пока нет учеников</div>}

          {students.map((s) => {
            const cur = state[s.id];
            return (
              <div key={s.id} className="list-row">
                <div className="av2" style={{ background: avatarColor(s.name) }}>
                  {initials(s.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div className="mut" style={{ fontSize: 12 }}>{s.grade ?? "—"}</div>
                </div>
                <input type="hidden" name={`att_${s.id}`} value={cur} />
                <div style={{ display: "flex", gap: 4, flex: "none" }}>
                  {STATES.map((st) => {
                    const active = cur === st.key;
                    return (
                      <button
                        key={st.key}
                        type="button"
                        disabled={!editor}
                        onClick={() => setState((p) => ({ ...p, [s.id]: st.key }))}
                        className={`chip ${active ? st.cls : "c-mut"}`}
                        style={{ minWidth: 52, justifyContent: "center", cursor: editor ? "pointer" : "default", opacity: active ? 1 : 0.55, border: "none" }}
                      >
                        {active && <span className="d" />}
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {canCancel && cancelOpen && (
            <div style={{ padding: "14px 18px", borderTop: "1px solid var(--line-2)", background: "var(--surface-2)" }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ink-3)", fontWeight: 700, marginBottom: 8 }}>
                Почему занятие не состоялось
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                {FAULTS.map((f) => (
                  <label key={f.key} style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 13 }}>
                    <input
                      type="radio"
                      name="cancel-fault"
                      checked={fault === f.key}
                      onChange={() => setFault(f.key)}
                      style={{ marginTop: 3 }}
                    />
                    <span>
                      <span style={{ fontWeight: 600 }}>{f.label}</span>
                      <span className="mut" style={{ display: "block", fontSize: 11.5 }}>{f.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Комментарий: болезнь, праздник, авария…"
                style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 9, padding: "9px 12px", fontSize: 14, color: "var(--ink)", width: "100%" }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="btn" type="button" onClick={confirmCancel} disabled={pending} style={{ color: "var(--bad)" }}>
                  {pending ? "Отменяем…" : "Отменить занятие"}
                </button>
                <button className="btn ghost" type="button" onClick={() => setCancelOpen(false)} disabled={pending}>
                  Назад
                </button>
              </div>
            </div>
          )}

          {editor && students.length > 0 && (
            <div className="modal-f" style={{ borderTop: "1px solid var(--line-2)" }}>
              {saved && (
                <span className="chip c-ok" style={{ marginRight: "auto" }}>
                  <span className="d" />
                  Сохранено
                </span>
              )}
              <button className="btn ghost" type="button" onClick={allPresent} disabled={pending} title="Отметить всех присутствующими">
                Все пришли
              </button>
              <button className="btn" type="submit" disabled={pending}>
                <Icon name="check" size={16} />
                {pending ? "Сохраняем…" : "Сохранить отметки"}
              </button>
            </div>
          )}
        </form>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ink-3)", fontWeight: 700, marginBottom: 12 }}>
            Дата занятия
          </div>
          <input
            type="date"
            defaultValue={date}
            onChange={(e) => e.target.value && changeDate(e.target.value)}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 9,
              padding: "9px 12px",
              fontSize: 14,
              color: "var(--ink)",
              width: "100%",
            }}
          />
          <div className="mut" style={{ fontSize: 12, marginTop: 8 }}>
            Занятие проходит по: {["", "понедельникам", "вторникам", "средам", "четвергам", "пятницам", "субботам"][weekday]}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          {cancelled ? (
            <>
              <div className="kval num" style={{ fontSize: 30, color: "var(--bad)" }}>—</div>
              <div className="ktrend">занятие в этот день отменено</div>
            </>
          ) : (
            <>
              <div className="kval num" style={{ fontSize: 30 }}>
                {presentCount}/{students.length}
              </div>
              <div className="ktrend">присутствуют на этом занятии</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
