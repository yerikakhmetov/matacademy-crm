"use client";

import { useEffect } from "react";
import Link from "next/link";

// Сбой страницы внутри CRM: вместо общего «Application error» — понятное сообщение
// и повтор. digest — номер ошибки в логах Vercel, по нему её можно найти.
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="card" style={{ maxWidth: 560, margin: "40px auto", padding: 24 }} role="alert">
      <h2 style={{ fontSize: 18, marginBottom: 8 }}>Страница не загрузилась</h2>
      <p className="mut" style={{ fontSize: 14, marginBottom: 16 }}>
        Данные не изменились. Попробуйте ещё раз; если ошибка повторяется, сообщите администратору код ниже.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn" type="button" onClick={() => retry()}>
          Повторить
        </button>
        <Link className="btn ghost" href="/dashboard">
          На главную
        </Link>
        {error.digest && <span className="mut num" style={{ fontSize: 12 }}>Код: {error.digest}</span>}
      </div>
    </div>
  );
}
