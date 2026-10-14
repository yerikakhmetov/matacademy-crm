import { test } from "node:test";
import assert from "node:assert/strict";
import { gradeChipClass, scoreColor } from "./format.ts";

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
