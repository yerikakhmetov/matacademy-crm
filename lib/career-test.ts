import { localDigits } from "./phone.ts";

// Профориентационный тест (MentorHub): у каждого ученика своя ссылка.
// Список из MentorHub вставляется строками «Имя | Телефон | Ссылка» (или скопированной
// таблицей Excel с табуляциями). Ученика ищем по телефону, без телефона — по точному имени.
// Чистая функция (без БД), покрыта тестами в career-test.test.ts.

const URL_RE = /https?:\/\/[^\s|,;]+/i;

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();

export function parseCareerLinks(
  text: string,
  students: { id: string; name: string; phone: string | null }[],
): { matched: { studentId: string; url: string }[]; unmatched: string[] } {
  const byPhone = new Map<string, string>();
  const byName = new Map<string, string[]>();
  for (const s of students) {
    const d = s.phone ? localDigits(s.phone) : null;
    if (d) byPhone.set(d, s.id);
    const k = norm(s.name);
    byName.set(k, [...(byName.get(k) ?? []), s.id]);
  }

  const matched = new Map<string, string>(); // studentId -> url (последняя строка побеждает)
  const unmatched: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const url = URL_RE.exec(line)?.[0];
    if (!url) {
      // строка заголовка («Аты Телефон Token») — не ошибка
      if (!/\d{5,}/.test(line)) continue;
      unmatched.push(line);
      continue;
    }
    const cells = line.replace(url, "").split(/\t|\|/).map((c) => c.trim()).filter(Boolean);
    let id: string | undefined;
    for (const c of cells) {
      const d = localDigits(c);
      if (d && byPhone.has(d)) {
        id = byPhone.get(d);
        break;
      }
    }
    if (!id) {
      for (const c of cells) {
        const ids = byName.get(norm(c));
        if (ids?.length === 1) {
          id = ids[0];
          break;
        }
      }
    }
    if (id) matched.set(id, url);
    else unmatched.push(line);
  }
  return { matched: [...matched].map(([studentId, url]) => ({ studentId, url })), unmatched };
}
