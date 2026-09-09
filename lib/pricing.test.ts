import { test } from "node:test";
import assert from "node:assert/strict";
import { combineDiscounts, computePricing, multiPercentFor, multiTierFor, parseMultiTiers, splitByPrice } from "./pricing.ts";


test("combineDiscounts: без скидок", () => {
  assert.equal(combineDiscounts([], "add"), 0);
  assert.equal(combineDiscounts([0, 0], "max"), 0);
});

test("combineDiscounts: три режима дают разный итог", () => {
  assert.equal(combineDiscounts([10, 10], "add"), 20);
  assert.equal(combineDiscounts([10, 10], "max"), 10);
  assert.equal(combineDiscounts([10, 10], "mul"), 19); // 1 - 0.9*0.9
});

test("combineDiscounts: потолок 100% и отрицательные части", () => {
  assert.equal(combineDiscounts([60, 60], "add"), 100);
  assert.equal(combineDiscounts([-5, 150], "add"), 100); // -5 → 0, 150 → 100
  assert.equal(combineDiscounts([-5, 20], "add"), 20);
});

test("multiPercentFor: берётся наибольший подходящий порог", () => {
  const tiers = [
    { count: 2, percent: 10 },
    { count: 3, percent: 15 },
  ];
  assert.equal(multiPercentFor(1, tiers), 0);
  assert.equal(multiPercentFor(2, tiers), 10);
  assert.equal(multiPercentFor(3, tiers), 15);
  assert.equal(multiPercentFor(9, tiers), 15);
});

test("computePricing: база, скидка и доли предметов", () => {
  const r = computePricing({
    subjects: [
      { id: "a", name: "Алгебра", price: 10000 },
      { id: "b", name: "Геометрия", price: 5000 },
    ],
    months: 2,
    discountParts: [10],
    mode: "add",
  });
  assert.equal(r.base, 30000);
  assert.equal(r.totalPct, 10);
  assert.equal(r.total, 27000);
  assert.equal(r.items.reduce((a, i) => a + i.amount, 0), r.total, "сумма долей = итог");
});

test("computePricing: доли сходятся к итогу при некрасивых числах", () => {
  const r = computePricing({
    subjects: [
      { id: "a", name: "A", price: 3333 },
      { id: "b", name: "B", price: 3333 },
      { id: "c", name: "C", price: 3334 },
    ],
    months: 3,
    discountParts: [7, 5],
    mode: "mul",
  });
  assert.equal(r.items.reduce((a, i) => a + i.amount, 0), r.total, "остаток уходит последнему предмету");
});

test("computePricing: без предметов — нули, без деления на ноль", () => {
  const r = computePricing({ subjects: [], months: 1, discountParts: [10], mode: "add" });
  assert.equal(r.base, 0);
  assert.equal(r.total, 0);
  assert.deepEqual(r.items, []);
});

test("computePricing: months меньше 1 считается как 1", () => {
  const r = computePricing({ subjects: [{ id: "a", name: "A", price: 1000 }], months: 0, discountParts: [], mode: "add" });
  assert.equal(r.base, 1000);
});

test("splitByPrice: делит пропорционально и сходится к сумме", () => {
  const rows = splitByPrice(10000, [
    { id: "a", name: "A", price: 3000 },
    { id: "b", name: "B", price: 1000 },
  ]);
  assert.deepEqual(rows.map((r) => r.amount), [7500, 2500]);
  assert.equal(rows.reduce((a, r) => a + r.amount, 0), 10000);
});

test("splitByPrice: при нулевых ценах — поровну", () => {
  const rows = splitByPrice(999, [
    { id: "a", name: "A", price: 0 },
    { id: "b", name: "B", price: 0 },
  ]);
  assert.equal(rows.reduce((a, r) => a + r.amount, 0), 999);
});

// --- Пакет «4 предмета = 60 000 ₸» (МатАкадемия) ---
// Выборные: 24 000 ₸/мес за 12 занятий. Обязательные (мат. грамотность,
// история Казахстана): 18 000 ₸/мес за 8 занятий.
const ELECTIVE = 24000;
const REQUIRED = 18000;
const FOUR = [
  { id: "a", name: "Физика", price: ELECTIVE },
  { id: "b", name: "Химия", price: ELECTIVE },
  { id: "c", name: "Мат. грамотность", price: REQUIRED },
  { id: "d", name: "История Казахстана", price: REQUIRED },
];

test("фиксированная цена пакета выражается точно, процентом — нет", () => {
  const tiers = parseMultiTiers("4 | 60000");
  assert.deepEqual(tiers, [{ count: 4, percent: 0, fixed: 60000 }]);
  // процент за такой пакет — 28,57%, целым числом его не записать
  const tier = multiTierFor(4, tiers);
  const r = computePricing({ subjects: FOUR, months: 1, discountParts: [], mode: "add", packagePrice: tier?.fixed });
  assert.equal(r.base, 84000);
  assert.equal(r.total, 60000, "пакет стоит ровно 60 000, без потерь на округлении");
  assert.equal(r.packagePct, 29, "для отчётов округляем, но на цену это не влияет");
});

test("доли предметов делятся пропорционально прайсу и сходятся к 60 000", () => {
  const r = computePricing({ subjects: FOUR, months: 1, discountParts: [], mode: "add", packagePrice: 60000 });
  const by = Object.fromEntries(r.items.map((i) => [i.name, i.amount]));
  assert.equal(by["Физика"], 17143);
  assert.equal(by["Химия"], 17143);
  assert.equal(by["Мат. грамотность"], 12857);
  assert.equal(by["История Казахстана"], 12857);
  assert.equal(r.items.reduce((a, i) => a + i.amount, 0), 60000, "сумма долей равна цене пакета");
});

test("скидка ложится на все предметы одинаковым процентом", () => {
  const r = computePricing({ subjects: FOUR, months: 1, discountParts: [], mode: "add", packagePrice: 60000 });
  const ratios = r.items.map((i) => i.amount / i.base);
  for (const x of ratios) assert.ok(Math.abs(x - ratios[0]) < 0.001, "ни один предмет не скинут сильнее другого");
});

test("личная скидка и промокод считаются уже от цены пакета", () => {
  const r = computePricing({ subjects: FOUR, months: 1, discountParts: [10], mode: "add", packagePrice: 60000 });
  assert.equal(r.total, 54000, "10% от 60 000, а не от прайса 84 000");
});

test("пакет за несколько месяцев умножается", () => {
  const r = computePricing({ subjects: FOUR, months: 3, discountParts: [], mode: "add", packagePrice: 60000 });
  assert.equal(r.base, 252000);
  assert.equal(r.total, 180000);
});

test("цена пакета выше прайса не делает абонемент дороже", () => {
  const two = [FOUR[2], FOUR[3]]; // два обязательных = 36 000 по прайсу
  const r = computePricing({ subjects: two, months: 1, discountParts: [], mode: "add", packagePrice: 60000 });
  assert.equal(r.total, 36000);
});

test("порог с фиксированной ценой не даёт процентной скидки — иначе она сложится дважды", () => {
  const tiers = parseMultiTiers("2 | 10\n4 | 60000");
  assert.equal(multiPercentFor(2, tiers), 10);
  assert.equal(multiPercentFor(4, tiers), 0);
  assert.equal(multiTierFor(4, tiers)?.fixed, 60000);
});

test("процент со знаком % остаётся процентом", () => {
  assert.deepEqual(parseMultiTiers("3 | 15%"), [{ count: 3, percent: 15 }]);
});
