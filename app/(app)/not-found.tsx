import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card" style={{ maxWidth: 560, margin: "40px auto", padding: 24 }}>
      <h2 style={{ fontSize: 18, marginBottom: 8 }}>Не найдено</h2>
      <p className="mut" style={{ fontSize: 14, marginBottom: 16 }}>
        Запись удалена, перенесена в архив или у вас нет к ней доступа.
      </p>
      <Link className="btn" href="/dashboard">
        На главную
      </Link>
    </div>
  );
}
