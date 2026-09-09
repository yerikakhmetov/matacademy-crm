import { test } from "node:test";
import assert from "node:assert/strict";
import { combineDiscounts, computePricing, multiPercentFor, multiTierFor, parseMultiTiers, splitAmount, splitWeights } from "./pricing.ts";


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

test("splitAmount: делит пропорционально и сходится к сумме", () => {
  const rows = splitAmount(10000, [
    { id: "a", name: "A", price: 3000 },
    { id: "b", name: "B", price: 1000 },
  ]);
  assert.deepEqual(rows.map((r) => r.amount), [7500, 2500]);
  assert.equal(rows.reduce((a, r) => a + r.amount, 0), 10000);
});

test("splitAmount: при нулевых весах — поровну", () => {
  const rows = splitAmount(999, [
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
  { id: "a", name: "Физика", price: ELECTIVE, lessonsPerMonth: 12 },
  { id: "b", name: "Химия", price: ELECTIVE, lessonsPerMonth: 12 },
  { id: "c", name: "Мат. грамотность", price: REQUIRED, lessonsPerMonth: 8 },
  { id: "d", name: "История Казахстана", price: REQUIRED, lessonsPerMonth: 8 },
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

test("доли предметов делятся по числу занятий и сходятся к 60 000", () => {
  // 12 + 12 + 8 + 8 = 40 занятий, 60 000 / 40 = 1 500 ₸ за занятие
  const r = computePricing({ subjects: FOUR, months: 1, discountParts: [], mode: "add", packagePrice: 60000 });
  const by = Object.fromEntries(r.items.map((i) => [i.name, i.amount]));
  assert.equal(by["Физика"], 18000);
  assert.equal(by["Химия"], 18000);
  assert.equal(by["Мат. грамотность"], 12000);
  assert.equal(by["История Казахстана"], 12000);
  assert.equal(r.items.reduce((a, i) => a + i.amount, 0), 60000, "сумма долей равна цене пакета");
});

test("занятие стоит одинаково в любом предмете", () => {
  const r = computePricing({ subjects: FOUR, months: 1, discountParts: [], mode: "add", packagePrice: 60000 });
  const perLesson = r.items.map((i, idx) => i.amount / FOUR[idx].lessonsPerMonth);
  for (const x of perLesson) assert.equal(x, 1500);
});

test("занятия не заданы — откат на цену прайса", () => {
  const noLessons = FOUR.map((s) => ({ id: s.id, name: s.name, price: s.price }));
  assert.deepEqual(splitWeights(noLessons), [24000, 24000, 18000, 18000]);
  const r = computePricing({ subjects: noLessons, months: 1, discountParts: [], mode: "add", packagePrice: 60000 });
  const by = Object.fromEntries(r.items.map((i) => [i.name, i.amount]));
  assert.equal(by["Физика"], 17143);
  assert.equal(by["Мат. грамотность"], 12857);
});

test("занятия заданы не у всех — делим по прайсу, иначе предмет получит ноль", () => {
  const mixed = [
    { id: "a", name: "Физика", price: ELECTIVE, lessonsPerMonth: 12 },
    { id: "c", name: "Мат. грамотность", price: REQUIRED, lessonsPerMonth: 0 },
  ];
  assert.deepEqual(splitWeights(mixed), [24000, 18000]);
  const rows = splitAmount(42000, mixed);
  assert.equal(rows[0].amount, 24000);
  assert.equal(rows[1].amount, 18000);
});

test("платёж делится теми же весами, что и абонемент", () => {
  const rows = splitAmount(60000, FOUR);
  assert.deepEqual(rows.map((r) => r.amount), [18000, 18000, 12000, 12000]);
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
