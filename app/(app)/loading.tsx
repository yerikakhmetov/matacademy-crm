// Пока сервер собирает страницу — каркас вместо пустого экрана.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Загрузка">
      <div className="skel" style={{ height: 30, width: 240, marginBottom: 10 }} />
      <div className="skel" style={{ height: 14, width: 320, marginBottom: 24 }} />
      <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skel" style={{ height: 18, width: `${90 - i * 7}%` }} />
        ))}
      </div>
    </div>
  );
}
