import { test } from "node:test";
import assert from "node:assert/strict";
import { chosenIndices, convertAnswer, correctIndices, isAnswered, isMulti, isRight, maskOf, scoreAnswers, toggleOption } from "./test-answer.ts";

const single = { correct: 2, correctSet: [] };
const multi = { correct: 0, correctSet: [0, 2, 5] };

test("обычный вопрос: засчитан только совпавший индекс", () => {
  assert.equal(isMulti(single), false);
  assert.deepEqual(correctIndices(single), [2]);
  assert.equal(isRight(single, 2), true);
  assert.equal(isRight(single, 1), false);
  assert.equal(isRight(single, -1), false);
  assert.deepEqual(chosenIndices(single, 3), [3]);
  assert.equal(isAnswered(single, 0), true, "вариант A — это 0, а не «без ответа»");
});

test("несколько верных: засчитан только точный набор", () => {
  assert.equal(isMulti(multi), true);
  const all = maskOf([0, 2, 5]);
  assert.equal(isRight(multi, all), true);
  assert.equal(isRight(multi, maskOf([0, 2])), false, "не все верные");
  assert.equal(isRight(multi, maskOf([0, 2, 5, 1])), false, "лишний вариант");
  assert.equal(isRight(multi, -1), false);
  assert.equal(isRight(multi, 0), false);
  assert.deepEqual(chosenIndices(multi, maskOf([5, 0])), [0, 5]);
  assert.equal(isAnswered(multi, 0), false, "пустая маска — без ответа");
});

test("старый вопрос без correctSet ведёт себя как раньше", () => {
  assert.equal(isMulti({ correct: 1 }), false);
  assert.equal(isRight({ correct: 1, correctSet: null }, 1), true);
  assert.equal(isMulti({ correct: 1, correctSet: [1] }), false, "один элемент — обычный вопрос");
});

test("переключение галочки и пустой выбор", () => {
  let c = -1;
  c = toggleOption(c, 0);
  c = toggleOption(c, 2);
  assert.deepEqual(chosenIndices(multi, c), [0, 2]);
  c = toggleOption(c, 0);
  c = toggleOption(c, 2);
  assert.equal(c, -1, "сняли все — снова без ответа");
});

test("балл: доля засчитанных вопросов", () => {
  const r = scoreAnswers([single, multi], [2, maskOf([0, 2, 5])], 10);
  assert.deepEqual(r, { total: 2, correctCount: 2, score: 10 });
  assert.deepEqual(scoreAnswers([single, multi], [2, maskOf([0, 2])], 10), { total: 2, correctCount: 1, score: 5 });
  assert.deepEqual(scoreAnswers([], [], 10), { total: 0, correctCount: 0, score: 0 });
});

test("смена типа вопроса при обновлении: ответы переводятся", () => {
  const oldSingle = { correct: 2, correctSet: [] };
  const newMulti = { correct: 2, correctSet: [2, 4] };
  assert.equal(convertAnswer(oldSingle, newMulti, 2), maskOf([2]), "выбранный C остаётся C");
  assert.equal(convertAnswer(oldSingle, newMulti, -1), -1);
  assert.equal(convertAnswer(newMulti, oldSingle, maskOf([4])), 4);
  assert.equal(convertAnswer(newMulti, oldSingle, maskOf([2, 4])), -1, "два варианта в обычный вопрос не переносятся");
  assert.equal(convertAnswer(oldSingle, oldSingle, 3), 3);
});
