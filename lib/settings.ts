import { prisma } from "./prisma";

export type Tariff = { plan: string; months: number; price: number };

const DEFAULT_TARIFFS: Tariff[] = [
  { plan: "1 месяц", months: 1, price: 18000 },
  { plan: "3 месяца", months: 3, price: 54000 },
  { plan: "6 месяцев", months: 6, price: 90000 },
  { plan: "Годовой", months: 12, price: 168000 },
];

export async function getSettings() {
  return prisma.settings.upsert({ where: { id: "main" }, update: {}, create: { id: "main" } });
}

export function parseTariffs(json: string): Tariff[] {
  try {
    const a = JSON.parse(json);
    if (Array.isArray(a) && a.length > 0) return a;
  } catch {
    /* ignore */
  }
  return DEFAULT_TARIFFS;
}

export function parseList(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

// Разбор textarea "план | месяцы | цена" в массив тарифов
export function tariffsFromText(text: string): Tariff[] {
  const out: Tariff[] = [];
  for (const line of text.split("\n")) {
    const parts = line.split("|").map((x) => x.trim());
    if (parts.length < 3 || !parts[0]) continue;
    const months = parseInt(parts[1], 10);
    const price = parseInt(parts[2].replace(/\s/g, ""), 10);
    if (isNaN(months) || isNaN(price)) continue;
    out.push({ plan: parts[0], months, price });
  }
  return out;
}

export function tariffsToText(tariffs: Tariff[]): string {
  return tariffs.map((t) => `${t.plan} | ${t.months} | ${t.price}`).join("\n");
}

// ── Шаблоны напоминаний ──
// Плейсхолдеры: {school} {name} {purpose} {amount} {days} {plan} {date}
export const DEFAULT_TEMPLATES = {
  overdue: "Здравствуйте! Напоминаем об оплате обучения в {school} (ученик: {name}): {purpose} — {amount}. Просрочено на {days} дн. Пожалуйста, оплатите при возможности. Спасибо!",
  pending: "Здравствуйте! Напоминаем об оплате в {school} (ученик: {name}): {purpose} — {amount}. Ждём оплату. Спасибо!",
  expiring: "Здравствуйте! Абонемент «{plan}» ученика {name} истекает {date}. Предлагаем продлить заранее. Спасибо, что вы с {school}!",
};

export function renderTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

// ── Скидки ──
export type Discount = { name: string; percent: number };
export type MultiTier = { count: number; percent: number };

// "Название | процент" построчно
export function parseDiscounts(text: string): Discount[] {
  const out: Discount[] = [];
  for (const line of (text ?? "").split("\n")) {
    const parts = line.split("|").map((x) => x.trim());
    if (parts.length < 2 || !parts[0]) continue;
    const percent = parseInt(parts[1].replace(/[^\d]/g, ""), 10);
    if (isNaN(percent) || percent <= 0) continue;
    out.push({ name: parts[0], percent: Math.min(percent, 100) });
  }
  return out;
}

export function discountsToText(list: Discount[]): string {
  return list.map((d) => `${d.name} | ${d.percent}`).join("\n");
}

// "Кол-во предметов | процент" построчно
export function parseMultiTiers(text: string): MultiTier[] {
  const out: MultiTier[] = [];
  for (const line of (text ?? "").split("\n")) {
    const parts = line.split("|").map((x) => x.trim());
    if (parts.length < 2) continue;
    const count = parseInt(parts[0].replace(/[^\d]/g, ""), 10);
    const percent = parseInt(parts[1].replace(/[^\d]/g, ""), 10);
    if (isNaN(count) || isNaN(percent) || count < 2 || percent <= 0) continue;
    out.push({ count, percent: Math.min(percent, 100) });
  }
  // по возрастанию количества
  return out.sort((a, b) => a.count - b.count);
}

export function multiTiersToText(list: MultiTier[]): string {
  return list.map((t) => `${t.count} | ${t.percent}`).join("\n");
}

// Процент скидки за N предметов: берём наибольший подходящий порог
export function multiPercentFor(count: number, tiers: MultiTier[]): number {
  let pct = 0;
  for (const t of tiers) if (count >= t.count) pct = t.percent;
  return pct;
}

// Расчёт цены комбо-абонемента за весь срок с разбивкой по предметам (доля предмета)
export function computePricing(opts: {
  subjects: { id: string; name: string; price: number }[]; // выбранные предметы (цена за месяц)
  months: number;
  discountPct: number; // спец-скидка
  multiPct: number; // скидка за несколько предметов
}) {
  const months = Math.max(1, opts.months);
  const items = opts.subjects.map((s) => ({ id: s.id, name: s.name, base: Math.max(0, s.price) * months }));
  const base = items.reduce((a, i) => a + i.base, 0);
  const totalPct = Math.min(100, Math.max(0, opts.discountPct) + Math.max(0, opts.multiPct));
  const total = Math.round((base * (100 - totalPct)) / 100);
  // разложить итог пропорционально базовым долям (последнему предмету — остаток, чтобы сумма сошлась)
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
