// Расходы школы: категории и расчёты для страницы «Расходы».
// Чистые функции (без БД), покрыты тестами в expenses.test.ts.

// Порядок — как в списке выбора. Старые коды (RENT, UTILITIES, ADS, EQUIPMENT, TAX, OTHER)
// сохранены: уже внесённые расходы остаются в своих категориях.
export const EXPENSE_CATEGORIES: { key: string; label: string; hint: string }[] = [
  { key: "RENT", label: "Аренда", hint: "помещение, кабинеты" },
  { key: "UTILITIES", label: "Коммунальные", hint: "свет, вода, отопление, вывоз мусора" },
  { key: "INTERNET", label: "Связь и интернет", hint: "интернет, телефон, мобильная связь" },
  { key: "ADS", label: "Маркетинг и реклама", hint: "таргет, Instagram, 2ГИС, листовки, баннеры" },
  { key: "OFFICE", label: "Канцелярия и офис", hint: "бумага, картриджи, ручки, маркеры, хозтовары" },
  { key: "STUDY", label: "Учебные материалы", hint: "книги, сборники, распечатки, пробные ЕНТ" },
  { key: "EQUIPMENT", label: "Оборудование и мебель", hint: "доски, парты, проектор, ноутбук" },
  { key: "SOFTWARE", label: "Сервисы и подписки", hint: "CRM, Zoom, MentorHub, хостинг" },
  { key: "REPAIR", label: "Ремонт и обслуживание", hint: "ремонт, мастер, техобслуживание" },
  { key: "CLEANING", label: "Уборка", hint: "клининг, моющие средства" },
  { key: "EVENTS", label: "Мероприятия и призы", hint: "олимпиады, подарки ученикам, праздники" },
  { key: "TRANSPORT", label: "Транспорт", hint: "такси, доставка, бензин" },
  { key: "BANK", label: "Банк и комиссии", hint: "Kaspi, эквайринг, обслуживание счёта" },
  { key: "TAX", label: "Налоги и сборы", hint: "налоги, пенсионные, госпошлины" },
  { key: "OTHER", label: "Прочее", hint: "всё остальное" },
];

export const EXPENSE_CATEGORY: Record<string, string> = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.key, c.label]));

export const isExpenseCategory = (k: string) => k in EXPENSE_CATEGORY;

// Категории, которые обычно повторяются каждый месяц — в форме по умолчанию «ежемесячный».
export const USUALLY_MONTHLY = new Set(["RENT", "UTILITIES", "INTERNET", "SOFTWARE"]);

type E = { category: string; amount: number };

// Сводка по категориям за месяц и сравнение с прошлым: сначала самые большие.
export function categorySummary(cur: E[], prev: E[]) {
  const sum = (list: E[]) => {
    const m = new Map<string, number>();
    for (const e of list) m.set(e.category, (m.get(e.category) ?? 0) + e.amount);
    return m;
  };
  const c = sum(cur);
  const p = sum(prev);
  const total = [...c.values()].reduce((a, v) => a + v, 0);
  const keys = new Set([...c.keys(), ...p.keys()]);
  return [...keys]
    .map((key) => ({
      key,
      sum: c.get(key) ?? 0,
      prev: p.get(key) ?? 0,
      share: total > 0 ? Math.round(((c.get(key) ?? 0) / total) * 100) : 0,
    }))
    .filter((r) => r.sum > 0 || r.prev > 0)
    .sort((a, b) => b.sum - a.sum || b.prev - a.prev);
}

// Какие ежемесячные расходы прошлого месяца ещё не перенесены в этот:
// перенос помечается ссылкой copiedFromId, поэтому повторное нажатие ничего не дублирует.
export function recurringToCopy<P extends { id: string; recurring: boolean }>(prevMonth: P[], thisMonth: { copiedFromId: string | null }[]): P[] {
  const copied = new Set(thisMonth.map((e) => e.copiedFromId).filter(Boolean));
  return prevMonth.filter((e) => e.recurring && !copied.has(e.id));
}
