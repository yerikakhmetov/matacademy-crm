"use client";

import { useTransition } from "react";
import { deleteHomework } from "@/app/actions/data";
import { Icon } from "@/components/Icon";

export function DeleteHomeworkButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="close-x"
      style={{ width: 30, height: 30 }}
      disabled={pending}
      title="Удалить задание"
      onClick={() => {
        if (confirm("Удалить это домашнее задание?")) start(() => deleteHomework(id));
      }}
    >
      <Icon name="close" size={16} />
    </button>
  );
}
