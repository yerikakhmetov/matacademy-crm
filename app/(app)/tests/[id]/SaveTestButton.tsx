"use client";

import { useFormStatus } from "react-dom";

export function SaveTestButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? "Сохранение…" : "Сохранить баллы"}
    </button>
  );
}
