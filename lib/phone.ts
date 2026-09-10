// Единый вид телефона: +7 (XXX) XXX-XX-XX.
//
// Номер хранится уже приведённым, а не форматируется при выводе. Так он
// одинаково выглядит везде без правок в каждом списке, и — важнее — сравнение
// становится надёжным: скидка «брат/сестра» ищет родителя по точному
// совпадению parentPhone, и «87051234567» с «+7 705 123 45 67» её теряли.

const KZ_LEN = 10; // столько цифр в номере без кода страны

export function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

// Десять цифр казахстанского/российского номера или null, если это не он.
export function localDigits(raw: string): string | null {
  const d = phoneDigits(raw);
  if (d.length === KZ_LEN) return d;
  // 8 705… и 7 705… — одна и та же десятка с кодом страны впереди
  if (d.length === KZ_LEN + 1 && (d[0] === "7" || d[0] === "8")) return d.slice(1);
  return null;
}

// Привести к единому виду. Незнакомый формат (иностранный номер, добавочный,
// незаконченный ввод) не ломаем — возвращаем как есть, только без лишних пробелов.
export function normalizePhone(raw: string | null | undefined): string {
  const src = (raw ?? "").trim();
  if (!src) return "";
  const d = localDigits(src);
  if (!d) return src.replace(/\s+/g, " ");
  return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
}

// null для пустой строки — в базе «нет телефона» это null, а не "".
export function normalizePhoneOrNull(raw: string | null | undefined): string | null {
  const v = normalizePhone(raw);
  return v === "" ? null : v;
}

// Уже приведён к стандарту?
export function isNormalized(raw: string): boolean {
  return /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/.test(raw);
}
