import { test } from "node:test";
import assert from "node:assert/strict";
import { combineDiscounts, computePricing, multiPercentFor, splitByPrice } from "./pricing.ts";

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
