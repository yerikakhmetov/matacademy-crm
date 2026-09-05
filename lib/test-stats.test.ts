import { test } from "node:test";
import assert from "node:assert/strict";
import { hardestQuestions, questionStats } from "./test-stats.ts";

const QS = [
  { correct: 0, optionsCount: 3 }, // вопрос 1
  { correct: 2, optionsCount: 3 }, // вопрос 2
];

test("считает верные ответы и распределение по вариантам", () => {
  const stats = questionStats(QS, [
    { answers: [0, 2] }, // оба верно
    { answers: [1, 2] }, // первый неверно
    { answers: [0, 0] }, // второй неверно
  ]);
  assert.equal(stats[0].correct, 2);
  assert.equal(stats[0].correctPct, 67);
  assert.deepEqual(stats[0].byOption, [2, 1, 0]);
  assert.equal(stats[1].correct, 2);
  assert.deepEqual(stats[1].byOption, [1, 0, 2]);
});

test("пропущенные вопросы не считаются ни верными, ни выбранными", () => {
  const stats = questionStats(QS, [{ answers: [-1, 2] }, { answers: [0, -1] }]);
  assert.equal(stats[0].answered, 1);
  assert.equal(stats[0].skipped, 1);
  assert.deepEqual(stats[0].byOption, [1, 0, 0]);
  assert.equal(stats[1].skipped, 1);
});

test("без попыток статистика нулевая, а не NaN", () => {
  const stats = questionStats(QS, []);
  assert.equal(stats[0].correctPct, 0);
  assert.equal(stats[0].answered, 0);
  assert.deepEqual(stats[0].byOption, [0, 0, 0]);
});

test("ответ вне списка вариантов не ломает подсчёт", () => {
  const stats = questionStats(QS, [{ answers: [9, 2] }]);
  assert.equal(stats[0].answered, 1);
  assert.equal(stats[0].correct, 0);
  assert.deepEqual(stats[0].byOption, [0, 0, 0], "лишний индекс не попадает в распределение");
});

test("hardestQuestions выбирает самые провальные и сортирует по возрастанию", () => {
  const stats = questionStats(
    [{ correct: 0, optionsCount: 2 }, { correct: 0, optionsCount: 2 }, { correct: 0, optionsCount: 2 }],
    [{ answers: [0, 1, 1] }, { answers: [0, 1, 0] }]
  );
  const hard = hardestQuestions(stats, 60);
  assert.deepEqual(hard.map((h) => h.index), [1, 2], "вопрос 1 решён всеми — в список не попал");
  assert.ok(hard[0].correctPct <= hard[1].correctPct);
});
