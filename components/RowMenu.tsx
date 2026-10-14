"use client";

import { useEffect, useRef, useState } from "react";

// Меню «⋯» для строки таблицы: редкие и опасные действия убраны с глаз, строка остаётся низкой.
// Содержимое не размонтируется при закрытии, а только прячется: внутри бывают ModalButton,
// и их открытое окно должно пережить закрытие меню.
export function RowMenu({ children, label = "Ещё действия" }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="row-menu" ref={ref}>
      <button
        type="button"
        className="btn ghost row-menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {/* клик по пункту закрывает меню; модальное окно пункта при этом остаётся открытым */}
      <div className="row-menu-pop" role="menu" hidden={!open} onClick={() => setOpen(false)}>
        {children}
      </div>
    </div>
  );
}
