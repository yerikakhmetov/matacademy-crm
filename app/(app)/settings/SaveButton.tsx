"use client";

import { useFormStatus } from "react-dom";
import { Icon } from "@/components/Icon";

export function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      <Icon name="check" size={16} />
      {pending ? "Сохраняем…" : "Сохранить настройки"}
    </button>
  );
}
