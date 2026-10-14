import { test } from "node:test";
import assert from "node:assert/strict";
import { invoicePeriodLabel, periodLabel } from "./period.ts";

const d = (y: number, m0: number, day = 1) => new Date(Date.UTC(y, m0, day));

test("подпись календарного периода (старые счета)", () => {
  assert.equal(periodLabel(d(2026, 9), 1), "октябрь 2026");
  assert.equal(periodLabel(d(2026, 9, 14), 3), "окт – дек 2026");
  assert.equal(periodLabel(d(2026, 11), 3), "дек 2026 – фев 2027");
});

test("новый счёт подписывается месяцем обучения, старый — календарным", () => {
  assert.equal(invoicePeriodLabel({ date: d(2026, 9, 14), months: 1, studyMonth: 1 }), "1-й месяц");
  assert.equal(invoicePeriodLabel({ date: d(2026, 9, 14), months: 3, studyMonth: 2 }), "2–4-й месяцы");
  assert.equal(invoicePeriodLabel({ date: d(2026, 8), months: 1, studyMonth: null }), "сентябрь 2026");
});
