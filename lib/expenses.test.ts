import { test } from "node:test";
import assert from "node:assert/strict";
import { EXPENSE_CATEGORY, categorySummary, recurringToCopy } from "./expenses.ts";

test("расходы: старые коды категорий остаются", () => {
  for (const k of ["RENT", "UTILITIES", "ADS", "EQUIPMENT", "TAX", "OTHER"]) assert.ok(EXPENSE_CATEGORY[k], k);
  assert.equal(EXPENSE_CATEGORY.OFFICE, "Канцелярия и офис");
});

test("расходы: сводка по категориям — доля, прошлый месяц, сортировка по сумме", () => {
  const r = categorySummary(
    [
      { category: "RENT", amount: 150000 },
      { category: "ADS", amount: 30000 },
      { category: "ADS", amount: 20000 },
    ],
    [
      { category: "RENT", amount: 150000 },
      { category: "OFFICE", amount: 8000 }, // в этом месяце не было — строка с нулём
    ],
  );
  assert.deepEqual(r, [
    { key: "RENT", sum: 150000, prev: 150000, share: 75 },
    { key: "ADS", sum: 50000, prev: 0, share: 25 },
    { key: "OFFICE", sum: 0, prev: 8000, share: 0 },
  ]);
});

test("расходы: перенос ежемесячных — только помеченные и ещё не перенесённые", () => {
  const prev = [
    { id: "rent", recurring: true },
    { id: "light", recurring: true },
    { id: "pens", recurring: false },
  ];
  assert.deepEqual(recurringToCopy(prev, [{ copiedFromId: "rent" }, { copiedFromId: null }]).map((e) => e.id), ["light"]);
});
