import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canFixReceived,
  planPaymentEdit,
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

// ---- Исправление счёта ----
const paidOnce = { amount: 25000, paidAmount: 25000, refundedAmount: 0, txs: [{ id: "t1", kind: "PAYMENT", amount: 25000 }] };

test("опечатка в «Принять оплату»: исправляется и счёт, и сам приход", () => {
  const plan = planPaymentEdit(paidOnce, 24000, true);
  assert.deepEqual(plan, { ok: true, mode: "single", txId: "t1", paidAmount: 24000 });
});

test("без галочки меняется только счёт — и не ниже уже принятого", () => {
  assert.deepEqual(planPaymentEdit(paidOnce, 30000, false), { ok: true, mode: "invoice", paidAmount: 25000 });
  const low = planPaymentEdit(paidOnce, 20000, false);
  assert.equal(low.ok, false, "получили 25 000, счёт на 20 000 — это возврат, а не правка");
});

test("счёт без денег правится свободно", () => {
  const pending = { amount: 25000, paidAmount: 0, refundedAmount: 0, txs: [] };
  assert.deepEqual(planPaymentEdit(pending, 18000, true), { ok: true, mode: "invoice", paidAmount: 0 });
});

test("частичная оплата: приход не переписываем, счёт не ниже принятого", () => {
  const partial = { amount: 30000, paidAmount: 10000, refundedAmount: 0, txs: [{ id: "t1", kind: "PAYMENT", amount: 10000 }] };
  assert.equal(canFixReceived(partial), false);
  assert.deepEqual(planPaymentEdit(partial, 24000, true), { ok: true, mode: "invoice", paidAmount: 10000 });
  assert.equal(planPaymentEdit(partial, 8000, true).ok, false);
});

test("несколько приходов — какой из них неверный, неизвестно", () => {
  const two = {
    amount: 30000, paidAmount: 30000, refundedAmount: 0,
    txs: [{ id: "a", kind: "PAYMENT", amount: 10000 }, { id: "b", kind: "PAYMENT", amount: 20000 }],
  };
  assert.equal(canFixReceived(two), false);
  assert.equal(planPaymentEdit(two, 25000, true).ok, false, "ниже принятого, а переписать нечего");
});

test("после возврата приход тоже не переписываем", () => {
  const refunded = {
    amount: 25000, paidAmount: 25000, refundedAmount: 5000,
    txs: [{ id: "t1", kind: "PAYMENT", amount: 25000 }, { id: "r1", kind: "REFUND", amount: 5000 }],
  };
  assert.equal(canFixReceived(refunded), false);
  assert.equal(planPaymentEdit(refunded, 24000, true).ok, false);
});

test("ноль и мусор отклоняются", () => {
  assert.equal(planPaymentEdit(paidOnce, 0, true).ok, false);
  assert.equal(planPaymentEdit(paidOnce, -5, true).ok, false);
  assert.equal(planPaymentEdit(paidOnce, NaN, true).ok, false);
});

test("canFixReceived узнаёт одну полную оплату", () => {
  assert.equal(canFixReceived(paidOnce), true);
});

