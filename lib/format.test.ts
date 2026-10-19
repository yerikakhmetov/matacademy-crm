import { test } from "node:test";
import assert from "node:assert/strict";
import { gradeChipClass, gradeMonthSummary, scoreColor } from "./format.ts";

test("шкала оценок: 85+ зелёный, 60–84 жёлтый, ниже 60 красный", () => {
  assert.equal(gradeChipClass(100), "c-ok");
  assert.equal(gradeChipClass(85), "c-ok");
  assert.equal(gradeChipClass(84), "c-warn");
  assert.equal(gradeChipClass(67), "c-warn"); // раньше было красным
  assert.equal(gradeChipClass(60), "c-warn");
  assert.equal(gradeChipClass(59), "c-bad");
  assert.equal(gradeChipClass(0), "c-bad");
});

test("цвет процента совпадает со шкалой чипов", () => {
  assert.equal(scoreColor(90), "var(--ok)");
  assert.equal(scoreColor(77), "var(--amber)");
  assert.equal(scoreColor(40), "var(--bad)");
});

test("итоги месяца по видам оценок: только этот месяц, ДЗ первыми", () => {
  const g = (type: string, score: number, date: string, maxScore = 100) => ({ type, score, maxScore, date: new Date(date) });
  const r = gradeMonthSummary(
    [
      g("TEST", 60, "2026-10-05T00:00:00Z"),
      g("HOMEWORK", 80, "2026-10-03T00:00:00Z"),
      g("HOMEWORK", 7, "2026-10-10T00:00:00Z", 10),
      g("HOMEWORK", 10, "2026-09-30T00:00:00Z"), // прошлый месяц — не считается
    ],
    2026,
    9,
  );
  assert.deepEqual(r, [
    { type: "HOMEWORK", avg: 75, count: 2 },
    { type: "TEST", avg: 60, count: 1 },
  ]);
});
