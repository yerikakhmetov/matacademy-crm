import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TZ_OFFSET_HOURS, isTestOpen, shuffleForSeed, testAvailableAt } from "./tests.ts";

// 3 сентября 2026 — день недели вычисляем, чтобы тест не зависел от календаря в голове
const DATE = new Date(Date.UTC(2026, 8, 3));
const DOW = DATE.getUTCDay() === 0 ? 7 : DATE.getUTCDay();

test("тест открывается во время урока по расписанию (Алматы = UTC+5)", () => {
  const at = testAvailableAt(DATE, [{ dayOfWeek: DOW, startTime: "16:00" }]);
  assert.equal(at.toISOString(), "2026-09-03T11:00:00.000Z"); // 16:00 по Алматы
});

test("если в этот день несколько уроков — берётся самый поздний", () => {
  const at = testAvailableAt(DATE, [
    { dayOfWeek: DOW, startTime: "10:00" },
    { dayOfWeek: DOW, startTime: "16:00" },
  ]);
  assert.equal(at.toISOString(), "2026-09-03T11:00:00.000Z");
});

test("уроки в другие дни недели не влияют", () => {
  const other = DOW === 1 ? 2 : 1;
  const at = testAvailableAt(DATE, [{ dayOfWeek: other, startTime: "16:00" }]);
  // урока в этот день нет → начало дня теста по Алматы
  assert.equal(at.toISOString(), "2026-09-02T19:00:00.000Z");
});

test("isTestOpen: закрыт до урока, открыт после", () => {
  const lessons = [{ dayOfWeek: DOW, startTime: "16:00" }];
  assert.equal(isTestOpen(DATE, lessons, new Date("2026-09-03T10:59:00Z")), false);
  assert.equal(isTestOpen(DATE, lessons, new Date("2026-09-03T11:00:00Z")), true);
  assert.equal(isTestOpen(DATE, lessons, new Date("2026-09-04T08:00:00Z")), true);
});

test("некорректное время урока не ломает расчёт", () => {
  const at = testAvailableAt(DATE, [{ dayOfWeek: DOW, startTime: "" }]);
  assert.equal(Number.isNaN(at.getTime()), false);
});

test("часовой пояс берётся из настроек, а не зашит", () => {
  const lessons = [{ dayOfWeek: DOW, startTime: "16:00" }];
  // UTC+0: урок в 16:00 наступает в 16:00 UTC
  assert.equal(testAvailableAt(DATE, lessons, 0).toISOString(), "2026-09-03T16:00:00.000Z");
  // UTC+6 — на час раньше, чем при UTC+5
  assert.equal(testAvailableAt(DATE, lessons, 6).toISOString(), "2026-09-03T10:00:00.000Z");
  // по умолчанию — Алматы
  assert.equal(DEFAULT_TZ_OFFSET_HOURS, 5);
  assert.equal(
    testAvailableAt(DATE, lessons).toISOString(),
    testAvailableAt(DATE, lessons, DEFAULT_TZ_OFFSET_HOURS).toISOString()
  );
});

test("isTestOpen учитывает переданный часовой пояс", () => {
  const lessons = [{ dayOfWeek: DOW, startTime: "16:00" }];
  const t = new Date("2026-09-03T12:00:00Z");
  assert.equal(isTestOpen(DATE, lessons, t, 5), true);  // урок был в 11:00 UTC
  assert.equal(isTestOpen(DATE, lessons, t, 0), false); // урок будет в 16:00 UTC
});

test("shuffleForSeed: порядок стабилен для одного ученика и различается у разных", () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8];
  const a1 = shuffleForSeed(items, "test1|student1");
  const a2 = shuffleForSeed(items, "test1|student1");
  const b = shuffleForSeed(items, "test1|student2");
  assert.deepEqual(a1, a2, "обновление страницы не меняет порядок");
  assert.notDeepEqual(a1, b, "у другого ученика другой порядок");
  assert.deepEqual([...a1].sort((x, y) => x - y), items, "ничего не потеряно и не задвоено");
  assert.equal(a1.length, items.length);
});

test("shuffleForSeed: не портит исходный массив и работает на пустом", () => {
  const items = [1, 2, 3];
  const copy = [...items];
  shuffleForSeed(items, "seed");
  assert.deepEqual(items, copy);
  assert.deepEqual(shuffleForSeed([], "seed"), []);
});
