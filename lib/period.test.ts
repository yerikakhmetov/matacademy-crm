import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePeriodMonth, periodKey, periodLabel, periodOptions, periodStartDate } from "./period.ts";

const d = (y: number, m0: number, day = 1) => new Date(Date.UTC(y, m0, day));

test("parsePeriodMonth: месяц из формы, мусор — null", () => {
  assert.equal(parsePeriodMonth("2026-11")?.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(parsePeriodMonth("2026-13"), null);
  assert.equal(parsePeriodMonth("ноябрь"), null);
  assert.equal(parsePeriodMonth(null), null);
});

test("предоплата за будущий месяц начинается 1-го, текущий месяц — сегодня (чтобы не стать просрочкой)", () => {
  const today = d(2026, 9, 14);
  assert.equal(periodStartDate(d(2026, 11), today).toISOString(), "2026-12-01T00:00:00.000Z");
  assert.equal(periodStartDate(d(2026, 9), today).toISOString(), "2026-10-14T00:00:00.000Z");
  assert.equal(periodStartDate(d(2026, 8), today).toISOString(), "2026-09-01T00:00:00.000Z");
});

test("подпись периода", () => {
  assert.equal(periodLabel(d(2026, 9), 1), "октябрь 2026");
  assert.equal(periodLabel(d(2026, 9, 14), 3), "окт – дек 2026");
  assert.equal(periodLabel(d(2026, 11), 3), "дек 2026 – фев 2027");
});

test("список месяцев: 3 назад, 12 вперёд, через год", () => {
  const opts = periodOptions(d(2026, 9, 14));
  assert.equal(opts.length, 16);
  assert.equal(opts[0].value, "2026-07");
  assert.equal(opts[3].value, periodKey(d(2026, 9)));
  assert.equal(opts[15].value, "2027-10");
  assert.equal(opts[3].label, "октябрь 2026");
});
