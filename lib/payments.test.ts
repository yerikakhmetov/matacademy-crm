import { test } from "node:test";
import assert from "node:assert/strict";
import {
  maxAcceptable,
  maxRefundable,
  netReceived,
  outstanding,
  paymentStatus,
  settledRatio,
} from "./payments.ts";

const D = (s: string) => new Date(s);
const NOW = D("2026-09-15T10:00:00Z");

test("outstanding: остаток долга не бывает отрицательным", () => {
  assert.equal(outstanding(50000, 0), 50000);
  assert.equal(outstanding(50000, 20000), 30000);
  assert.equal(outstanding(50000, 50000), 0);
  assert.equal(outstanding(50000, 60000), 0, "переплата не делает долг отрицательным");
});

test("paymentStatus: частичная оплата видна отдельно", () => {
  assert.equal(paymentStatus(50000, 0, D("2026-09-20"), NOW), "PENDING");
  assert.equal(paymentStatus(50000, 20000, D("2026-09-20"), NOW), "PARTIAL");
  assert.equal(paymentStatus(50000, 50000, D("2026-09-20"), NOW), "PAID");
  assert.equal(paymentStatus(50000, 60000, D("2026-09-20"), NOW), "PAID");
});

test("paymentStatus: просрочка только когда ничего не заплатили", () => {
  assert.equal(paymentStatus(50000, 0, D("2026-09-01"), NOW), "OVERDUE");
  assert.equal(paymentStatus(50000, 20000, D("2026-09-01"), NOW), "PARTIAL", "частичная оплата важнее просрочки");
  assert.equal(paymentStatus(50000, 50000, D("2026-09-01"), NOW), "PAID");
});

test("paymentStatus: счёт сегодняшним днём ещё не просрочен", () => {
  assert.equal(paymentStatus(1000, 0, D("2026-09-15T00:00:00Z"), NOW), "PENDING");
});

test("netReceived: возврат уменьшает полученное", () => {
  assert.equal(netReceived(50000, 0), 50000);
  assert.equal(netReceived(50000, 20000), 30000);
  assert.equal(netReceived(50000, 50000), 0);
});

test("settledRatio: масштабирует разбивку по предметам", () => {
  assert.equal(settledRatio(50000, 50000, 0), 1);
  assert.equal(settledRatio(50000, 25000, 0), 0.5);
  assert.equal(settledRatio(50000, 50000, 25000), 0.5, "возврат половины = половина дохода");
  assert.equal(settledRatio(50000, 0, 0), 0);
  assert.equal(settledRatio(50000, 50000, 50000), 0, "вернули всё — дохода нет");
  assert.equal(settledRatio(0, 0, 0), 0, "нет деления на ноль");
  assert.equal(settledRatio(50000, 70000, 0), 1, "переплата не даёт больше 100%");
});

test("лимиты: нельзя принять больше долга и вернуть больше полученного", () => {
  assert.equal(maxAcceptable(50000, 20000), 30000);
  assert.equal(maxAcceptable(50000, 50000), 0);
  assert.equal(maxRefundable(50000, 0), 50000);
  assert.equal(maxRefundable(50000, 20000), 30000);
  assert.equal(maxRefundable(0, 0), 0);
});
