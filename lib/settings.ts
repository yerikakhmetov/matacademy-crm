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
