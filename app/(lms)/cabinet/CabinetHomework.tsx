"use client";

import { useState, useTransition } from "react";
import { removeMyHomeworkFile, toggleMyHomework } from "@/app/actions/data";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { t, type Locale } from "@/lib/i18n";

export type CabinetHW = {
  id: string;
  title: string;
  description: string | null;
  groupName: string;
  dueLabel: string | null;
  dueTs: number | null;
  done: boolean;
  fileUrl: string | null;
  fileName: string | null;
};

// Список ДЗ в кабинете ученика с возможностью отметить «выполнено» (оптимистично).
export function CabinetHomework({ items, locale }: { items: CabinetHW[]; locale: Locale }) {
  const [done, setDone] = useState<Record<string, boolean>>(
    Object.fromEntries(items.map((h) => [h.id, h.done]))
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const router = useRouter();

  // Прикрепить работу: файл уходит на сервер, оттуда — в хранилище
  const upload = async (homeworkId: string, file: File) => {
    setError(null);
    if (file.size > 20 * 1024 * 1024) {
      setError(t(locale, "hw.tooBig"));
      return;
    }
    setUploading(homeworkId);
    try {
      const fd = new FormData();
      fd.append("homeworkId", homeworkId);
      fd.append("file", file);
      const res = await fetch("/api/homework/submit", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Ошибка загрузки");
      else router.refresh();
    } catch {
      setError("Ошибка загрузки");
    } finally {
      setUploading(null);
    }
  };

  const toggle = (id: string) => {
    if (busy) return;
    const prev = done[id];
    setBusy(id);
    setDone((s) => ({ ...s, [id]: !prev })); // оптимистично
    start(async () => {
      try {
        const res = await toggleMyHomework(id);
        setDone((s) => ({ ...s, [id]: res.done }));
      } catch {
        setDone((s) => ({ ...s, [id]: prev })); // откат при ошибке
      } finally {
        setBusy(null);
      }
    });
  };

  return (
    <div className="card">
      <div className="card-h">
        <h3>{t(locale, "hw.title")}</h3>
        <span className="chip c-mut"><span className="d" />{items.length}</span>
      </div>
      <div style={{ padding: "6px 0" }}>
        {items.length === 0 && <div className="empty">{t(locale, "hw.empty")}</div>}
        {error && (
          <div style={{ padding: "8px 18px" }}>
            <span className="chip c-bad"><span className="d" />{error}</span>
          </div>
        )}
        {items.map((hw) => {
          const isDone = done[hw.id];
          const overdue = hw.dueTs != null && hw.dueTs < Date.now() && !isDone;
          const loading = busy === hw.id;
          return (
            <div className="list-row" key={hw.id}>
              <button
                type="button"
                onClick={() => toggle(hw.id)}
                disabled={loading}
                aria-pressed={isDone}
                title={isDone ? t(locale, "hw.markUndone") : t(locale, "hw.markDone")}
                style={{
                  width: 24,
                  height: 24,
                  flex: "none",
                  borderRadius: 7,
                  border: `1.5px solid ${isDone ? "var(--ok)" : "var(--line)"}`,
                  background: isDone ? "var(--ok)" : "transparent",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  cursor: loading ? "default" : "pointer",
                  opacity: loading ? 0.5 : 1,
                }}
              >
                {isDone && <Icon name="check" size={14} />}
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, textDecoration: isDone ? "line-through" : "none", color: isDone ? "var(--ink-3)" : "inherit" }}>
                  {hw.title}
                </div>
                {hw.description && (
                  <div className="mut" style={{ fontSize: 12.5, marginTop: 2, whiteSpace: "pre-wrap" }}>{hw.description}</div>
                )}
                <div className="mut" style={{ fontSize: 12, marginTop: 2 }}>
                  {hw.groupName}{hw.dueLabel ? ` · ${t(locale, "hw.due", { date: hw.dueLabel })}` : ""}
                </div>

                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {hw.fileUrl ? (
                    <>
                      <a
                        className="chip c-ok"
                        href={hw.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: "none", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        <span className="d" />
                        {hw.fileName ?? t(locale, "hw.attached")}
                      </a>
                      <label className="btn ghost" style={{ padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>
                        {uploading === hw.id ? t(locale, "hw.uploading") : t(locale, "hw.replace")}
                        <input
                          type="file"
                          hidden
                          disabled={uploading === hw.id}
                          onChange={(e) => e.target.files?.[0] && upload(hw.id, e.target.files[0])}
                        />
                      </label>
                      <button
                        className="btn ghost"
                        type="button"
                        style={{ padding: "4px 10px", fontSize: 12, color: "var(--bad)" }}
                        onClick={() => start(async () => { await removeMyHomeworkFile(hw.id); router.refresh(); })}
                      >
                        {t(locale, "hw.remove")}
                      </button>
                    </>
                  ) : (
                    <label className="btn ghost" style={{ padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>
                      <Icon name="export" size={13} />
                      {uploading === hw.id ? t(locale, "hw.uploading") : t(locale, "hw.attach")}
                      <input
                        type="file"
                        hidden
                        disabled={uploading === hw.id}
                        onChange={(e) => e.target.files?.[0] && upload(hw.id, e.target.files[0])}
                      />
                    </label>
                  )}
                  {!hw.fileUrl && (
                    <span className="mut" style={{ fontSize: 11.5 }}>{t(locale, "hw.uploadHint")}</span>
                  )}
                </div>
              </div>
              <span className={`chip ${isDone ? "c-ok" : overdue ? "c-bad" : "c-mut"}`}>
                <span className="d" />{isDone ? t(locale, "hw.done") : overdue ? t(locale, "hw.overdue") : t(locale, "hw.active")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
