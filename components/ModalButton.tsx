"use client";

import { useState } from "react";
import { Icon } from "./Icon";

// Универсальная кнопка + модальное окно с формой.
// action — серверный экшен, принимающий FormData.
export function ModalButton({
  label,
  title,
  action,
  children,
  buttonClass = "btn",
  icon = "plus",
  submitLabel = "Сохранить",
}: {
  label: string;
  title: string;
  action: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
  buttonClass?: string;
  icon?: string | null;
  submitLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <button className={buttonClass} onClick={() => setOpen(true)} type="button">
        {icon && <Icon name={icon} size={16} />}
        {label}
      </button>

      {open && (
        <div className="scrim" onClick={() => !busy && setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <form
              action={async (fd) => {
                setBusy(true);
                try {
                  await action(fd);
                  setOpen(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="modal-h">
                <h3>{title}</h3>
                <button className="close-x" type="button" onClick={() => setOpen(false)}>
                  <Icon name="close" size={18} />
                </button>
              </div>
              <div className="modal-b">{children}</div>
              <div className="modal-f">
                <button className="btn ghost" type="button" onClick={() => setOpen(false)}>
                  Отмена
                </button>
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? "Сохраняем…" : submitLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
