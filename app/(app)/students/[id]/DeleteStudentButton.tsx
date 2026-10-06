"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveStudent, deleteStudent, unarchiveStudent } from "@/app/actions/data";

// Обычный путь — архив: ученик выходит из групп, но оплаты, оценки и
// посещаемость остаются. Полное удаление уносит их каскадом, поэтому
// доступно только администратору и требует ввести имя.
export function DeleteStudentButton({
  id,
  name,
  isAdmin,
  archived,
}: {
  id: string;
  name: string;
  isAdmin: boolean;
  archived: boolean;
}) {
  const [mode, setMode] = useState<"idle" | "archive" | "delete">("idle");
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  if (mode === "idle") {
    return (
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {archived ? (
          <button
            className="btn ghost"
            type="button"
            disabled={pending}
            onClick={() => start(async () => { await unarchiveStudent(id); router.refresh(); })}
          >
            {pending ? "Возвращаем…" : "Вернуть из архива"}
          </button>
        ) : (
          <button className="btn ghost" type="button" onClick={() => setMode("archive")}>
            В архив
          </button>
        )}
        {isAdmin && (
          <button className="btn danger" type="button" onClick={() => setMode("delete")}>
            Удалить навсегда
          </button>
        )}
      </div>
    );
  }

  if (mode === "archive") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
          «{name}» получит статус «Ушёл» и выйдет из групп. Оплаты, оценки и посещаемость сохранятся —
          ученика можно вернуть в любой момент.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn ghost" type="button" onClick={() => setMode("idle")} disabled={pending}>
            Отмена
          </button>
          <button
            className="btn"
            type="button"
            disabled={pending}
            onClick={() => start(async () => { await archiveStudent(id); router.refresh(); setMode("idle"); })}
          >
            {pending ? "Отправляем…" : "Да, в архив"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13, color: "var(--bad)" }}>
        Удаление необратимо: вместе с учеником пропадут его оплаты, абонемент, оценки, посещаемость,
        домашние работы и результаты тестов. Восстановить их можно только из резервной копии базы.
        Для подтверждения введите имя ученика.
      </div>
      <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={name} />
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn ghost" type="button" onClick={() => { setMode("idle"); setTyped(""); }} disabled={pending}>
          Отмена
        </button>
        <button
          className="btn danger"
          type="button"
          disabled={pending || typed.trim() !== name.trim()}
          onClick={() => start(async () => { await deleteStudent(id); router.push("/students"); })}
        >
          {pending ? "Удаляем…" : "Удалить навсегда"}
        </button>
      </div>
    </div>
  );
}
