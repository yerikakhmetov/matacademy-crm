import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, isoDay, lastSchoolMonths, parseWeek, schoolMonthKey, schoolMonthStart, schoolToday, weekMonday } from "./school-time.ts";

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

test("неделя: понедельник для любого дня, воскресенье — конец недели", () => {
  assert.equal(isoDay(weekMonday(new Date(Date.UTC(2026, 9, 14)))), "2026-10-12"); // ср
  assert.equal(isoDay(weekMonday(new Date(Date.UTC(2026, 9, 18)))), "2026-10-12"); // вс
  assert.equal(isoDay(weekMonday(new Date(Date.UTC(2026, 9, 12)))), "2026-10-12"); // пн
});

test("parseWeek: кривой параметр — текущая неделя", () => {
  const today = new Date(Date.UTC(2026, 9, 14));
  assert.equal(isoDay(parseWeek("2026-10-21", today)), "2026-10-19");
  assert.equal(isoDay(parseWeek("мусор", today)), "2026-10-12");
  assert.equal(isoDay(parseWeek(undefined, today)), "2026-10-12");
  assert.equal(isoDay(addDays(parseWeek(undefined, today), -7)), "2026-10-05");
});
