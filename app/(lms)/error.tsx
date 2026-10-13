"use client";

import { useEffect } from "react";

// Сбой в кабинете ученика. Двуязычно: язык страницы здесь неизвестен.
export default function CabinetError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="card" style={{ maxWidth: 520, margin: "40px auto", padding: 24 }} role="alert">
      <h2 style={{ fontSize: 18, marginBottom: 8 }}>Бет жүктелмеді · Страница не загрузилась</h2>
      <p className="mut" style={{ fontSize: 14, marginBottom: 16 }}>
        Жауаптарыңыз сақталған. Қайталап көріңіз. · Ваши ответы сохранены. Попробуйте ещё раз.
      </p>
      <button className="btn" type="button" onClick={() => retry()}>
        Қайталау · Повторить
      </button>
      {error.digest && <p className="mut num" style={{ fontSize: 12, marginTop: 12 }}>Код: {error.digest}</p>}
    </div>
  );
}
