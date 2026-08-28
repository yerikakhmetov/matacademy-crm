"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteLesson } from "@/app/actions/data";

export function DeleteLessonButton({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!confirm) {
    return (
      <button className="btn ghost" type="button" onClick={() => setConfirm(true)}>
        Удалить занятие
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <span className="mut" style={{ fontSize: 13 }}>
        Удалить занятие?
      </span>
      <button className="btn ghost" type="button" onClick={() => setConfirm(false)} disabled={pending}>
        Нет
      </button>
      <button
        className="btn danger"
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await deleteLesson(id);
            router.push("/schedule");
          })
        }
      >
        {pending ? "Удаляем…" : "Да, удалить"}
      </button>
    </div>
  );
}
