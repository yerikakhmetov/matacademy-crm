import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRating, gradePoints } from "./rating.ts";

test("рейтинг: очки за оценку — процент ÷ 10 в пределах 0..10", () => {
  assert.equal(gradePoints(8, 10), 8);
  assert.equal(gradePoints(69, 100), 7);
  assert.equal(gradePoints(5, 0), 0);
  assert.equal(gradePoints(12, 10), 10);
});

test("рейтинг: посещения, оценки, ДЗ и зачёты складываются; ученики не из группы не считаются", () => {
  const r = computeRating({
    studentIds: ["a", "b", "c"],
    attendance: [
      { studentId: "a", present: true },
      { studentId: "a", present: false }, // пропуск — 0
      { studentId: "b", present: true },
      { studentId: "x", present: true }, // не из группы
    ],
    grades: [{ studentId: "b", score: 9, maxScore: 10 }],
    homeworkDone: [{ studentId: "a" }, { studentId: "a" }],
    zachetPassed: [{ studentId: "c" }],
  });
  const by = Object.fromEntries(r.map((x) => [x.studentId, x]));
  assert.equal(by.a.points, 2 + 6);
  assert.deepEqual(by.b.parts, { attend: 2, grades: 9, hw: 0, zachet: 0 });
  assert.equal(by.c.points, 5);
  assert.deepEqual(r.map((x) => x.studentId), ["b", "a", "c"]);
});

test("рейтинг: одинаковые очки — одно место, следующее место с пропуском", () => {
  const r = computeRating({
    studentIds: ["a", "b", "c"],
    attendance: [{ studentId: "a", present: true }, { studentId: "b", present: true }],
    grades: [],
    homeworkDone: [],
    zachetPassed: [],
  });
  assert.deepEqual(r.map((x) => x.place), [1, 1, 3]);
});
