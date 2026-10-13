"use client";

// Сбой в корневом layout: глобальные стили сюда не доходят, поэтому всё инлайн
// и по системной теме.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          background: "Canvas",
          color: "CanvasText",
          colorScheme: "light dark",
        }}
      >
        <main style={{ maxWidth: 520, margin: "80px auto", padding: "0 16px" }} role="alert">
          <h1 style={{ fontSize: 22 }}>МатАкадемия временно недоступна</h1>
          <p style={{ opacity: 0.75 }}>Данные не пострадали. Попробуйте обновить страницу через минуту.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ font: "inherit", padding: "10px 18px", borderRadius: 10, border: "1px solid currentColor", background: "transparent", color: "inherit", cursor: "pointer" }}
          >
            Повторить
          </button>
          {error.digest && <p style={{ fontSize: 12, opacity: 0.6 }}>Код: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
