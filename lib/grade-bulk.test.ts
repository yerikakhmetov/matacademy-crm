import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBulkScores } from "./grade-bulk.ts";

const students = [
  { id: "a", name: "Аян" },
  { id: "b", name: "Бота" },
  { id: "c", name: "Ерлан" },
];

test("оценки группе: пустые пропускаются, запятая и дробь округляются", () => {
  const r = parseBulkScores({ a: " 8 ", b: "", c: "7,6" }, students, 10);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.scores, [
    { studentId: "a", score: 8 },
    { studentId: "c", score: 8 },
  ]);
});

test("оценки группе: больше максимума или не число — ошибка с именем", () => {
  assert.match(parseBulkScores({ b: "12" }, students, 10).error ?? "", /Бота: 12 больше максимума 10/);
  assert.match(parseBulkScores({ a: "-1" }, students, 10).error ?? "", /Аян/);
  assert.match(parseBulkScores({ c: "н" }, students, 10).error ?? "", /Ерлан/);
});

test("оценки группе: ученики не из группы игнорируются", () => {
  assert.deepEqual(parseBulkScores({ x: "5" }, students, 10).scores, []);
});
