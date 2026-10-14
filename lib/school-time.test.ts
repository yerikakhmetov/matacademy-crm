import { test } from "node:test";
import assert from "node:assert/strict";
import { lastSchoolMonths, schoolMonthKey, schoolMonthStart, schoolToday } from "./school-time.ts";

const TZ = 5; // Алматы

test("оплата 1 октября в 02:00 по Алматы — это октябрь, хотя по UTC ещё сентябрь", () => {
  const paidAt = new Date(Date.UTC(2026, 8, 30, 21, 0)); // 1 окт 02:00 +05
  assert.equal(schoolMonthKey(paidAt, TZ), "2026-9");
  assert.ok(paidAt >= schoolMonthStart(2026, 9, TZ));
  assert.ok(paidAt < schoolMonthStart(2026, 10, TZ));
});

test("дата без времени (UTC-полночь) остаётся в своём месяце", () => {
  assert.equal(schoolMonthKey(new Date(Date.UTC(2026, 9, 1)), TZ), "2026-9");
  assert.equal(schoolMonthKey(new Date(Date.UTC(2026, 8, 30)), TZ), "2026-8");
  // и попадает в границы своего месяца
  assert.ok(new Date(Date.UTC(2026, 9, 1)) >= schoolMonthStart(2026, 9, TZ));
  assert.ok(new Date(Date.UTC(2026, 9, 31)) < schoolMonthStart(2026, 10, TZ));
});

test("сегодня школы: до 05:00 UTC в Алматы уже следующий день", () => {
  const now = Date.UTC(2026, 9, 13, 20, 30); // 14 окт 01:30 +05
  assert.equal(schoolToday(TZ, now).toISOString(), "2026-10-14T00:00:00.000Z");
});

test("последние месяцы переходят через год", () => {
  const now = Date.UTC(2026, 0, 10);
  const ms = lastSchoolMonths(3, TZ, now);
  assert.deepEqual(ms.map((m) => m.key), ["2025-10", "2025-11", "2026-0"]);
});
