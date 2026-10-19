import { test } from "node:test";
import assert from "node:assert/strict";
import { frequentAbsentees, lowHomework } from "./curator-home.ts";

const m = (studentId: string, present: boolean, excused = false) => ({ studentId, present, excused });

test("часто пропускающие: от двух пропусков, присутствие не считается", () => {
  const r = frequentAbsentees([m("a", false), m("a", false), m("a", true), m("b", false), m("c", true)]);
  assert.deepEqual(r, [{ studentId: "a", missed: 2, unexcused: 2 }]);
});

test("уважительные пропуски считаются, но прогулы без причины — выше в списке", () => {
  const r = frequentAbsentees([
    m("ok", false, true), m("ok", false, true), m("ok", false, true),
    m("bad", false), m("bad", false),
  ]);
  assert.deepEqual(r.map((x) => x.studentId), ["bad", "ok"]);
  assert.equal(r[1].missed, 3);
  assert.equal(r[1].unexcused, 0);
});

test("порог настраивается, пусто — пустой список", () => {
  assert.equal(frequentAbsentees([m("a", false)], 1).length, 1);
  assert.deepEqual(frequentAbsentees([]), []);
});

test("слабые ДЗ: средний по домашним ниже порога, другие виды оценок не считаются", () => {
  const g = (studentId: string, type: string, score: number, maxScore = 100) => ({ studentId, type, score, maxScore });
  const r = lowHomework([
    g("a", "HOMEWORK", 50), g("a", "HOMEWORK", 60), // 55
    g("b", "HOMEWORK", 3, 10), // 30
    g("c", "HOMEWORK", 90), g("c", "TEST", 10), // контрольная не тянет вниз
    g("d", "TEST", 20), // нет ДЗ — не в списке
  ]);
  assert.deepEqual(r, [
    { studentId: "b", avg: 30, count: 1 },
    { studentId: "a", avg: 55, count: 2 },
  ]);
});
