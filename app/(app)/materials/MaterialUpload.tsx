"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

export function MaterialUpload({ groups, groupId }: { groups: { id: string; name: string }[]; groupId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [group, setGroup] = useState(groupId === "all" ? "" : groupId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const submit = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Выберите файл"); return; }
    setError(null);
    setPending(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title);
      fd.append("groupId", group);
      const res = await fetch("/api/materials/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Ошибка загрузки");
      }
      setOpen(false);
      setTitle("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setPending(false);
    }
  };

  if (!open) {
    return (
      <button className="btn" type="button" onClick={() => setOpen(true)}>
        <Icon name="plus" size={16} />
        Загрузить файл
      </button>
    );
  }

  return (
    <div className="scrim" onClick={() => !pending && setOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h3>Новый материал</h3>
          <button className="close-x" type="button" onClick={() => setOpen(false)}><Icon name="close" size={18} /></button>
        </div>
        <div className="modal-b">
          <div className="field">
            <label>Название</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Домашка на неделю / Тест по дробям" />
          </div>
          <div className="field">
            <label>Группа</label>
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="">Для всех групп</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Файл (до 20 МБ)</label>
            <input ref={fileRef} type="file" />
          </div>
          {error && <div className="err" style={{ margin: 0 }}>{error}</div>}
        </div>
        <div className="modal-f">
          <button className="btn ghost" type="button" onClick={() => setOpen(false)} disabled={pending}>Отмена</button>
          <button className="btn" type="button" onClick={submit} disabled={pending}>{pending ? "Загрузка…" : "Загрузить"}</button>
        </div>
      </div>
    </div>
  );
}
