import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateVisits, creditFromItem, lessonsLeft, leftKey, nextStudyMonth, packageAlerts, studyMonthLabel, type Visit } from "./packages.ts";

const d = (m0: number, day: number) => new Date(Date.UTC(2026, m0, day));
const credit = (over: Partial<Parameters<typeof creditFromItem>[0]> = {}) =>
  creditFromItem({ paymentId: "p1", studentId: "s", subjectId: "math", itemAmount: 24_300, months: 1, lessonsPerMonth: 12, ratio: 1, order: 1, ...over })!;
const visits = (n: number, groupId = "g1", startDay = 1, m0 = 9): Visit[] =>
  Array.from({ length: n }, (_, i) => ({ studentId: "s", subjectId: "math", groupId, date: d(m0, startDay + i) }));

test("пакет: 12 занятий, цена занятия = доля ÷ 12", () => {
  const c = credit();
  assert.equal(c.lessons, 12);
  assert.equal(c.value, 2_025);
});

test("частичная оплата даёт часть занятий по полной цене", () => {
  assert.equal(credit({ ratio: 0.5 }).lessons, 6);
  assert.equal(credit({ ratio: 0.5 }).value, 2_025);
  assert.equal(creditFromItem({ paymentId: "p", studentId: "s", subjectId: "m", itemAmount: 100, months: 1, lessonsPerMonth: 12, ratio: 0, order: 1 }), null);
});

test("счёт на 3 месяца — 36 занятий; обязательный предмет — по 8", () => {
  assert.equal(credit({ months: 3, itemAmount: 72_900 }).lessons, 36);
  assert.equal(credit({ lessonsPerMonth: 8, itemAmount: 16_200 }).lessons, 8);
  assert.equal(credit({ lessonsPerMonth: 8, itemAmount: 16_200 }).value, 2_025);
});

test("старый календарный счёт: прошедшие до перехода месяцы не дают занятий", () => {
  assert.equal(credit({ months: 3, itemAmount: 72_000, skipMonths: 1 }).lessons, 24);
  assert.equal(creditFromItem({ paymentId: "p", studentId: "s", subjectId: "m", itemAmount: 24_000, months: 1, lessonsPerMonth: 12, ratio: 1, order: 1, skipMonths: 1 }), null);
});

test("списание: сначала старый счёт, сверх пакета — без оплаты", () => {
  const c1 = credit({ paymentId: "old", order: 1, itemAmount: 24_000 }); // 2 000 за занятие
  const c2 = credit({ paymentId: "new", order: 2, itemAmount: 12_000, ratio: 0.5 }); // 6 занятий по 1 000
  const res = allocateVisits([c2, c1], visits(20));
  assert.deepEqual(res.slice(0, 12).map((r) => r.paymentId), Array(12).fill("old"));
  assert.deepEqual(res.slice(12, 18).map((r) => r.value), Array(6).fill(1_000));
  assert.deepEqual(res.slice(18).map((r) => r.paymentId), [null, null]);
});

test("пакет переходит через календарный месяц: занятия платятся в своём месяце", () => {
  // 8 занятий в октябре, 4 в ноябре — один пакет на 12
  const v = [...visits(8, "g1", 14, 9), ...visits(4, "g1", 2, 10)];
  const res = allocateVisits([credit()], v);
  const oct = res.filter((r) => r.date.getUTCMonth() === 9).reduce((a, r) => a + r.value, 0);
  const nov = res.filter((r) => r.date.getUTCMonth() === 10).reduce((a, r) => a + r.value, 0);
  assert.equal(oct, 2_025 * 8);
  assert.equal(nov, 2_025 * 4);
});

test("ученик перешёл в другую группу — пакет общий для предмета", () => {
  const res = allocateVisits([credit()], [...visits(5, "gA", 1), ...visits(7, "gB", 10)]);
  assert.equal(res.filter((r) => r.groupId === "gB" && r.paymentId).length, 7);
});

test("остаток занятий", () => {
  const left = lessonsLeft([credit()], visits(5)).get(leftKey("s", "math"));
  assert.deepEqual(left, { left: 7, total: 12, unpaid: 0 });
  assert.deepEqual(lessonsLeft([credit()], visits(14)).get(leftKey("s", "math")), { left: 0, total: 12, unpaid: 2 });
  assert.deepEqual(lessonsLeft([], visits(3)).get(leftKey("s", "math")), { left: 0, total: 0, unpaid: 3 });
});

test("подпись и следующий месяц обучения", () => {
  assert.equal(studyMonthLabel(1, 1), "1-й месяц");
  assert.equal(studyMonthLabel(2, 3), "2–4-й месяцы");
  assert.equal(nextStudyMonth([]), 1);
  assert.equal(nextStudyMonth([{ studyMonth: 1, months: 1 }, { studyMonth: 2, months: 3 }]), 5);
  // два старых календарных счёта (сентябрь, октябрь) — следующий «3-й месяц»
  assert.equal(nextStudyMonth([{ studyMonth: null, months: 1 }, { studyMonth: null, months: 1 }]), 3);
  assert.equal(nextStudyMonth([{ studyMonth: null, months: 2 }, { studyMonth: 3, months: 1 }]), 4);
});

test("напоминания: мало занятий или ходит без оплаты, но не если счёт уже выставлен", () => {
  const left = new Map([
    [leftKey("a", "math"), { left: 1, total: 12, unpaid: 0 }],
    [leftKey("b", "math"), { left: 7, total: 12, unpaid: 0 }],
    [leftKey("c", "math"), { left: 0, total: 0, unpaid: 3 }],
    [leftKey("d", "math"), { left: 0, total: 12, unpaid: 0 }],
  ]);
  const enrolled = ["a", "b", "c", "d", "e"].map((studentId) => ({ studentId, subjectId: "math" }));
  const res = packageAlerts(enrolled, left, new Set([leftKey("d", "math")]));
  assert.deepEqual([...res.keys()], ["a", "c"]);
  // открытый счёт не скрывает того, кто уже ходит без оплаты
  // (здесь у d счёта нет, и его закончившийся пакет тоже в списке)
  assert.deepEqual([...packageAlerts(enrolled, left, new Set([leftKey("c", "math")])).keys()], ["a", "c", "d"]);
  assert.deepEqual(res.get("c"), [{ subjectId: "math", left: 0, unpaid: 3, total: 0 }]);
});
