"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { deleteMaterial } from "@/app/actions/data";

export type LessonMaterial = {
  id: string;
  title: string;
  fileUrl: string;
  fileName: string;
  uploadedBy: string | null;
};

// Материалы конкретного занятия: что разобрали в этот день.
// Файл уходит тем же маршрутом, что и материалы группы, но с id занятия и датой.
export function LessonMaterials({
  lessonId,
  date,
  items,
  canEdit,
}: {
  lessonId: string;
  date: string;
  items: LessonMaterial[];
  canEdit: boolean;
}) {
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Выберите файл");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title);
      fd.append("lessonId", lessonId);
      fd.append("date", date);
      const res = await fetch("/api/materials/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Ошибка загрузки");
      }
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setPending(false);
    }
  };

  const remove = async (id: string) => {
    setPending(true);
    try {
      await deleteMaterial(id);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="card">
      <div className="card-h">
        <h3>Материалы занятия</h3>
        <span className="chip c-mut">
          <span className="d" />
          {items.length}
        </span>
      </div>

      <div style={{ padding: "6px 0" }}>
        {items.length === 0 && <div className="empty">Файлов пока нет</div>}
        {items.map((m) => (
          <div className="list-row" key={m.id}>
            <span style={{ color: "var(--ink-3)", flex: "none" }}>
              <Icon name="book" size={16} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <a
                href={m.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontWeight: 600, color: "inherit", textDecoration: "none" }}
              >
                {m.title}
              </a>
              <div className="mut" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>
                {m.fileName}
                {m.uploadedBy ? ` · ${m.uploadedBy}` : ""}
              </div>
            </div>
            {canEdit && (
              <button
                type="button"
                className="btn ghost"
                style={{ padding: "5px 9px", color: "var(--bad)", flex: "none" }}
                disabled={pending}
                onClick={() => remove(m.id)}
                title="Удалить материал"
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--line-2)", display: "grid", gap: 8 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название (например: Конспект по дробям)"
            style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 9, padding: "9px 12px" }}
          />
          <input ref={fileRef} type="file" />
          {error && <div className="err" style={{ margin: 0 }}>{error}</div>}
          <button className="btn" type="button" onClick={upload} disabled={pending}>
            <Icon name="export" size={15} />
            {pending ? "Загрузка…" : "Загрузить материал"}
          </button>
          <p className="mut" style={{ fontSize: 11.5, margin: 0 }}>
            До 20 МБ. Файл появится у учеников группы в разделе «Материалы».
          </p>
        </div>
      )}
    </div>
  );
}
