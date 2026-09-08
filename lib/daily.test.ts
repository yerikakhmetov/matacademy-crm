import { test } from "node:test";
import assert from "node:assert/strict";
import { dayKeyInTz, groupByDay } from "./daily.ts";

const tx = (kind: string, amount: number, iso: string) => ({ kind, amount, date: new Date(iso) });

test("день считается по часовому поясу школы, а не по UTC", () => {
  // 8 сентября 21:00 в Алматы — это 16:00 UTC того же дня
  assert.equal(dayKeyInTz(new Date("2026-09-08T16:00:00Z"), 5), "2026-09-08");
  // а 8 сентября 02:00 в Алматы — это 7 сентября 21:00 UTC
  assert.equal(dayKeyInTz(new Date("2026-09-07T21:00:00Z"), 5), "2026-09-08", "вечерняя оплата не уезжает во вчера");
  assert.equal(dayKeyInTz(new Date("2026-09-07T21:00:00Z"), 0), "2026-09-07", "при UTC+0 тот же момент — другой день");
});

test("суммирует приходы и возвраты за день", () => {
  const g = groupByDay(
    [
      tx("PAYMENT", 50000, "2026-09-08T06:00:00Z"),
      tx("PAYMENT", 20000, "2026-09-08T09:00:00Z"),
      tx("REFUND", 15000, "2026-09-08T10:00:00Z"),
    ],
    5
  );
  assert.equal(g.length, 1);
  assert.equal(g[0].income, 70000);
  assert.equal(g[0].refund, 15000);
  assert.equal(g[0].net, 55000);
  assert.equal(g[0].count, 3);
});

test("дни идут от новых к старым, внутри дня — тоже", () => {
  const g = groupByDay(
    [
      tx("PAYMENT", 1, "2026-09-06T06:00:00Z"),
      tx("PAYMENT", 2, "2026-09-08T06:00:00Z"),
      tx("PAYMENT", 3, "2026-09-08T11:00:00Z"),
    ],
    5
  );
  assert.deepEqual(g.map((x) => x.day), ["2026-09-08", "2026-09-06"]);
  assert.deepEqual(g[0].items.map((i) => i.amount), [3, 2], "внутри дня новые сверху");
});

test("день только с возвратом даёт отрицательный итог", () => {
  const g = groupByDay([tx("REFUND", 5000, "2026-09-08T06:00:00Z")], 5);
  assert.equal(g[0].net, -5000);
  assert.equal(g[0].income, 0);
});

test("пустой список — пустой результат, без падений", () => {
  assert.deepEqual(groupByDay([], 5), []);
});
