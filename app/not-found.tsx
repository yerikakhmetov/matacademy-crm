import Link from "next/link";

// Неизвестный адрес. Двуязычно: сюда попадают и родители по старым ссылкам.
export default function NotFound() {
  return (
    <main style={{ maxWidth: 520, margin: "80px auto", padding: "0 16px", textAlign: "center" }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Страница не найдена · Бет табылмады</h1>
      <p className="mut" style={{ fontSize: 14, marginBottom: 20 }}>
        Проверьте ссылку или попросите новую у администратора. Сілтемені тексеріңіз немесе әкімшіден жаңасын сұраңыз.
      </p>
      <Link className="btn" href="/">
        На главную · Басты бет
      </Link>
    </main>
  );
}
