"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { unstable_rethrow } from "next/navigation";
import { Icon } from "./Icon";

// Ожидаемую ошибку экшен возвращает, а не бросает: в продакшне текст брошенной
// ошибки до браузера не доходит (Next скрывает его), а возвращённый — доходит.
export type ActionResult = void | { error?: string };

const GENERIC_ERROR = "Не удалось сохранить. Проверьте данные и попробуйте ещё раз; если повторится — обновите страницу.";

// Универсальная кнопка + модальное окно с формой.
// Окно рендерится порталом в body: кнопка часто стоит в ячейке таблицы, а стили td
// (white-space:nowrap, text-align:right) иначе наследуются окном и ломают вёрстку.
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
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  buttonClass?: string;
  icon?: string | null;
  submitLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Форму, в которую уже что-то ввели, не закрываем случайным кликом по фону
  const [dirty, setDirty] = useState(false);
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setError(null);
    setDirty(false);
    openerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    // Фокус — в первое поле окна, чтобы с клавиатуры и экранного диктора было понятно, где мы
    const first = modalRef.current?.querySelector<HTMLElement>(
      "input:not([type=hidden]):not([disabled]), select, textarea, button.btn"
    );
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy]);

  return (
    <>
      <button ref={openerRef} className={buttonClass} onClick={() => setOpen(true)} type="button">
        {icon && <Icon name={icon} size={16} />}
        {label}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div className="scrim" onClick={() => !dirty && close()}>
          <div
            ref={modalRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            <form
              onInput={() => setDirty(true)}
              action={async (fd) => {
                setBusy(true);
                setError(null);
                try {
                  const res = await action(fd);
                  if (res && typeof res === "object" && res.error) {
                    setError(res.error);
                    return;
                  }
                  setOpen(false);
                  setDirty(false);
                } catch (e) {
                  unstable_rethrow(e);
                  setError(GENERIC_ERROR);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="modal-h">
                <h3 id={titleId}>{title}</h3>
                <button className="close-x" type="button" onClick={close} aria-label="Закрыть">
                  <Icon name="close" size={18} />
                </button>
              </div>
              <div className="modal-b">{children}</div>
              {error && (
                <div className="err" role="alert" style={{ margin: "0 20px 12px" }}>
                  {error}
                </div>
              )}
              <div className="modal-f">
                <button className="btn ghost" type="button" onClick={close}>
                  Отмена
                </button>
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? "Сохраняем…" : submitLabel}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
