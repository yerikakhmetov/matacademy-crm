"use client";

import { useTransition } from "react";
import { deleteMaterial } from "@/app/actions/data";
import { Icon } from "@/components/Icon";

export function DeleteMaterialButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="icon-btn"
      type="button"
      disabled={pending}
      title="Удалить"
      style={{ width: 32, height: 32, color: "var(--bad)" }}
      onClick={() => { if (confirm("Удалить материал?")) start(() => deleteMaterial(id)); }}
    >
      <Icon name="close" size={16} />
    </button>
  );
}
