import { prisma } from "./prisma";
import type { Discount, MultiTier } from "./pricing";

// Чистая математика прайсинга живёт в lib/pricing.ts (без prisma, доступна и на клиенте).
// Реэкспорт для обратной совместимости со старыми импортами из "@/lib/settings".
export { multiPercentFor, multiTierFor, parseMultiTiers, splitByPrice, computePricing, combineDiscounts, isDiscountMode, DISCOUNT_MODE_LABEL } from "./pricing";
export type { Discount, MultiTier, DiscountMode } from "./pricing";

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
  grade: "{school}: у {name} новая оценка — «{topic}»: {score} из {max} ({pct}%).",
  homework: "{school}: новое домашнее задание по группе {group} — «{title}»{due}.",
  cancel: "{school}: занятие группы {group} {date} не состоится. {reason}",
};

export function renderTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

// ── Скидки (парсинг текстовых настроек; математика — в lib/pricing.ts) ──

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

export function multiTiersToText(list: MultiTier[]): string {
  // фиксированную цену пакета пишем числом, процент — со знаком %,
  // чтобы обратный разбор не спутал одно с другим
  return list.map((t) => `${t.count} | ${t.fixed != null ? t.fixed : `${t.percent}%`}`).join("\n");
}
