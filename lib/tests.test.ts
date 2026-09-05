import { test } from "node:test";
import assert from "node:assert/strict";
import { isTestOpen, testAvailableAt } from "./tests.ts";

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
