// Чистая математика прайсинга — БЕЗ импорта prisma, чтобы работать и на клиенте (форма),
// и на сервере (actions). Здесь только расчёты; парсинг настроек — в lib/settings.ts.

export type Discount = { name: string; percent: number };
export type MultiTier = { count: number; percent: number };

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

// Скидка за N предметов: берём наибольший подходящий порог.
export function multiPercentFor(count: number, tiers: MultiTier[]): number {
  let pct = 0;
  for (const t of [...tiers].sort((a, b) => a.count - b.count)) if (count >= t.count) pct = t.percent;
  return pct;
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

// Пропорциональное деление суммы между предметами по их базовой цене.
// Если у всех цена 0 — поровну. Последнему предмету — остаток (сумма всегда сходится).
export function splitByPrice(
  amount: number,
  subjects: { id: string; name: string; price: number }[]
): { id: string; name: string; amount: number }[] {
  const n = subjects.length;
  if (n === 0) return [];
  const weights = subjects.map((s) => Math.max(0, s.price));
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
export function computePricing(opts: {
  subjects: { id: string; name: string; price: number }[]; // цена за месяц
  months: number;
  discountParts: number[];
  mode: DiscountMode;
}) {
  const months = Math.max(1, opts.months);
  const items = opts.subjects.map((s) => ({ id: s.id, name: s.name, base: Math.max(0, s.price) * months }));
  const base = items.reduce((a, i) => a + i.base, 0);
  const totalPct = combineDiscounts(opts.discountParts, opts.mode);
  const total = Math.round((base * (100 - totalPct)) / 100);
  const withAmounts: { id: string; name: string; base: number; amount: number }[] = [];
  let acc = 0;
  items.forEach((it, i) => {
    let amount: number;
    if (i === items.length - 1) amount = total - acc;
    else {
      amount = base > 0 ? Math.round((total * it.base) / base) : 0;
      acc += amount;
    }
    withAmounts.push({ ...it, amount });
  });
  return { base, total, totalPct, items: withAmounts };
}
