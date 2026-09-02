"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveAttendance } from "@/app/actions/data";
import { initials, avatarColor } from "@/lib/format";
import { Icon } from "@/components/Icon";

type AttState = "present" | "excused" | "unexcused";
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
  marked,
  weekday,
  topic,
}: {
  lessonId: string;
  date: string;
  students: S[];
  editor: boolean;
  marked: boolean;
  weekday: number;
  topic: string;
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

  function submit(formData: FormData) {
    start(async () => {
      await saveAttendance(lessonId, date, formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="two-col">
      <form action={submit} className="card">
        <div className="card-h">
          <h3>Посещаемость</h3>
          <span className={`chip ${marked ? "c-ok" : "c-mut"}`}>
            <span className="d" />
            {marked ? "Отмечено" : "Не отмечено"}
          </span>
        </div>

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

        {editor && students.length > 0 && (
          <div className="modal-f" style={{ borderTop: "1px solid var(--line-2)" }}>
            {saved && (
              <span className="chip c-ok" style={{ marginRight: "auto" }}>
                <span className="d" />
                Сохранено
              </span>
            )}
            <button className="btn" type="submit" disabled={pending}>
              <Icon name="check" size={16} />
              {pending ? "Сохраняем…" : "Сохранить отметки"}
            </button>
          </div>
        )}
      </form>

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
          <div className="kval num" style={{ fontSize: 30 }}>
            {presentCount}/{students.length}
          </div>
          <div className="ktrend">присутствуют на этом занятии</div>
        </div>
      </div>
    </div>
  );
}
