"use client";

import { Icon } from "@/components/Icon";

export function PrintButton() {
  return (
    <button className="btn" type="button" onClick={() => window.print()}>
      <Icon name="export" size={16} />
      Скачать PDF / Печать
    </button>
  );
}
