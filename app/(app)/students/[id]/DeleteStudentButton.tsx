"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteStudent } from "@/app/actions/data";

export function DeleteStudentButton({ id, name }: { id: string; name: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!confirm) {
    return (
      <button className="btn danger" type="button" onClick={() => setConfirm(true)}>
        Удалить ученика
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
        Удалить «{name}» и все связанные оплаты? Действие необратимо.
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn ghost" type="button" onClick={() => setConfirm(false)} disabled={pending}>
          Отмена
        </button>
        <button
          className="btn danger"
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await deleteStudent(id);
              router.push("/students");
            })
          }
        >
          {pending ? "Удаляем…" : "Да, удалить"}
        </button>
      </div>
    </div>
  );
}
