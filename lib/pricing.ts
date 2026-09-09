// Чистая математика прайсинга — БЕЗ импорта prisma, чтобы работать и на клиенте (форма),
// и на сервере (actions). Здесь только расчёты; парсинг настроек — в lib/settings.ts.

export type Discount = { name: string; percent: number };
// Скидка за N предметов задаётся ЛИБО процентом, ЛИБО фиксированной ценой пакета
// за месяц (fixed). Фиксированная цена нужна, когда «4 предмета = 60 000 ₸»:
// процентом такую цену точно не выразить — она зависит от набора предметов
// и всё равно теряется на округлении процента до целого.
export type MultiTier = { count: number; percent: number; fixed?: number };

// Как объединяются несколько скидок (спец, мульти-предмет, персональная, брат/сестра, промокод):
//   add — складываются (10% + 10% = 20%), с потолком 100%
//   max — берётся только самая большая
//   mul — «скидка на скидку» (10% затем 10% = 19%)
export type DiscountMode = "add" | "max" | "mul";

export const DISCOUNT_MODE_LABEL: Record<DiscountMode, string> = {
  add: "Складывать (10% + 10% = 20%)",
  max: "Только наибольшую",
  mul: "Каскадом (10%, потом 10% = 19%)",
};

export function isDiscountMode(v: string | null | undefined): v is DiscountMode {
  return v === "add" || v === "max" || v === "mul";
}

// Разбор настройки «скидки за несколько предметов» построчно.
export function parseMultiTiers(text: string): MultiTier[] {
  const out: MultiTier[] = [];
  for (const line of (text ?? "").split("\n")) {
    const parts = line.split("|").map((x) => x.trim());
    if (parts.length < 2) continue;
    const count = parseInt(parts[0].replace(/[^\d]/g, ""), 10);
    const raw = parts[1];
    const value = parseInt(raw.replace(/[^\d]/g, ""), 10);
    if (isNaN(count) || isNaN(value) || count < 2 || value <= 0) continue;
    // «4 | 60000» — фиксированная цена пакета за месяц, «4 | 25» или «4 | 25%» — процент.
    // Процент больше 100 не бывает, поэтому большое число читаем как цену.
    const isFixed = !raw.includes("%") && value > 100;
    out.push(isFixed ? { count, percent: 0, fixed: value } : { count, percent: Math.min(value, 100) });
  }
  // по возрастанию количества
  return out.sort((a, b) => a.count - b.count);
}

// Подходящий порог за N предметов: берём наибольший, который уже достигнут.
export function multiTierFor(count: number, tiers: MultiTier[]): MultiTier | null {
  let hit: MultiTier | null = null;
  for (const t of [...tiers].sort((a, b) => a.count - b.count)) if (count >= t.count) hit = t;
  return hit;
}

// Скидка за N предметов в процентах. У порога с фиксированной ценой процента нет —
// он задаёт итог напрямую, поэтому здесь 0, чтобы скидка не сложилась дважды.
export function multiPercentFor(count: number, tiers: MultiTier[]): number {
  const t = multiTierFor(count, tiers);
  if (!t || t.fixed != null) return 0;
  return t.percent;
}

// Объединить несколько процентных скидок в один эффективный процент (0..100).
export function combineDiscounts(parts: number[], mode: DiscountMode): number {
  const ps = parts.map((p) => Math.min(100, Math.max(0, Math.round(p || 0)))).filter((p) => p > 0);
  if (ps.length === 0) return 0;
  if (mode === "max") return Math.max(...ps);
  if (mode === "mul") {
    const remain = ps.reduce((r, p) => r * (1 - p / 100), 1);
    return Math.min(100, Math.round((1 - remain) * 100));
  }
  return Math.min(100, ps.reduce((a, b) => a + b, 0));
}

// Предмет прайса: цена за месяц и сколько занятий в эту цену входит
// (выборные — 12, обязательные — 8).
export type PriceSubject = { id: string; name: string; price: number; lessonsPerMonth?: number };

// Веса, по которым сумма делится между предметами — ЧИСЛО ЗАНЯТИЙ.
// Школа продаёт занятия, поэтому занятие стоит одинаково в любом предмете.
// Если хотя бы у одного предмета занятия не заданы, делить по ним нельзя —
// такой предмет получил бы ноль, поэтому откатываемся на цену прайса.
export function splitWeights(subjects: PriceSubject[]): number[] {
  const lessons = subjects.map((s) => Math.max(0, s.lessonsPerMonth ?? 0));
  if (lessons.length > 0 && lessons.every((l) => l > 0)) return lessons;
  return subjects.map((s) => Math.max(0, s.price));
}

// Деление суммы между предметами по весам. Если все веса нулевые — поровну.
// Последнему предмету — остаток, чтобы доли всегда сходились к сумме.
export function splitAmount(
  amount: number,
  subjects: PriceSubject[]
): { id: string; name: string; amount: number }[] {
  const n = subjects.length;
  if (n === 0) return [];
  const weights = splitWeights(subjects);
  const totalW = weights.reduce((a, b) => a + b, 0);
  const out: { id: string; name: string; amount: number }[] = [];
  let acc = 0;
  subjects.forEach((s, i) => {
    let amt: number;
    if (i === n - 1) amt = amount - acc;
    else {
      amt = totalW > 0 ? Math.round((amount * weights[i]) / totalW) : Math.round(amount / n);
      acc += amt;
    }
    out.push({ id: s.id, name: s.name, amount: amt });
  });
  return out;
}

// Расчёт цены комбо-абонемента за весь срок с разбивкой по предметам (доля предмета).
// discountParts — все применяемые скидки в процентах; mode — правило их объединения.
// packagePrice — фиксированная цена пакета ЗА МЕСЯЦ (порог «4 предмета = 60 000»);
// если она задана, она заменяет собой скидку за количество предметов, а личные
// скидки, «брат/сестра» и промокод считаются уже от неё.
//
// Доля каждого предмета — пропорционально числу занятий: занятие стоит одинаково
// в любом предмете, поэтому преподаватель получает за проведённое занятие столько же,
// какой бы предмет он ни вёл. Занятия не заданы — откат на цену прайса (splitWeights).
export function computePricing(opts: {
  subjects: PriceSubject[]; // цена за месяц + занятий в месяц
  months: number;
  discountParts: number[];
  mode: DiscountMode;
  packagePrice?: number | null;
}) {
  const months = Math.max(1, opts.months);
  const items = opts.subjects.map((s) => ({ id: s.id, name: s.name, base: Math.max(0, s.price) * months }));
  const base = items.reduce((a, i) => a + i.base, 0);

  // цена пакета не должна оказаться выше прайса — иначе «скидка» дорожает абонемент
  const pkg = opts.packagePrice != null && opts.packagePrice >= 0 ? Math.min(opts.packagePrice * months, base) : null;
  const afterPackage = pkg ?? base;
  const packagePct = pkg != null && base > 0 ? Math.round(((base - pkg) / base) * 100) : 0;

  const totalPct = combineDiscounts(opts.discountParts, opts.mode);
  const total = Math.round((afterPackage * (100 - totalPct)) / 100);

  const shares = splitAmount(total, opts.subjects);
  const withAmounts = items.map((it, i) => ({ ...it, amount: shares[i].amount }));
  return { base, total, totalPct, packagePct, packagePrice: pkg, items: withAmounts };
}
