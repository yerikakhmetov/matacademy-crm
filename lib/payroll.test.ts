import { test } from "node:test";
import assert from "node:assert/strict";
import { computePayrollRows, feeKey, isPayableAttendance, payableKey, type PayrollTeacher } from "./payroll-calc.ts";

const teacher = (lessonsPerWeek: number, subjectId: string | null = "math"): PayrollTeacher => ({
  id: "t1",
  groups: [{ id: "g1", subjectId, lessonsPerWeek, studentIds: ["s1"] }],
});

const run = (t: PayrollTeacher, payableCount: number, fee: number, feePct = 3) =>
  computePayrollRows({
    teachers: [t],
    payable: new Map([[payableKey("g1", "s1"), payableCount]]),
    monthlyFee: new Map([[feeKey("s1", "math"), fee]]),
    feePct,
  }).get("t1")!;

test("оплачивается присутствие и прогул без причины, но не уважительный", () => {
  assert.equal(isPayableAttendance(true, false), true, "был на уроке");
  assert.equal(isPayableAttendance(false, false), true, "прогул без причины — платят");
  assert.equal(isPayableAttendance(false, true), false, "уважительная — не платят");
});

test("3 занятия в неделю: делитель 12, полный месяц даёт всю долю минус 3%", () => {
  const r = run(teacher(3), 12, 12000);
  assert.equal(r.base, 12000);
  assert.equal(r.salary, 11640); // 12000 − 3%
  assert.equal(r.paidLessons, 12);
  assert.equal(r.students, 1);
});

test("2 занятия в неделю: делитель 8", () => {
  const r = run(teacher(2), 8, 8000);
  assert.equal(r.base, 8000);
});

test("пропущенные занятия уменьшают начисление пропорционально", () => {
  const r = run(teacher(3), 10, 12000); // 10 из 12
  assert.equal(r.base, 10000);
  assert.equal(r.paidLessons, 10);
});

test("удержание школы 0% — к выплате равно начисленному", () => {
  const r = run(teacher(3), 12, 12000, 0);
  assert.equal(r.salary, r.base);
});

test("группа без предмета не приносит зарплату", () => {
  const r = run(teacher(3, null), 12, 12000);
  assert.equal(r.base, 0);
  assert.equal(r.salary, 0);
  assert.equal(r.paidLessons, 0);
});

test("группа без занятий в расписании пропускается (нет деления на ноль)", () => {
  const r = run(teacher(0), 12, 12000);
  assert.equal(r.base, 0);
  assert.equal(Number.isFinite(r.salary), true);
});

test("ученик без месячной доли: посещения считаются, денег нет", () => {
  const r = computePayrollRows({
    teachers: [teacher(3)],
    payable: new Map([[payableKey("g1", "s1"), 12]]),
    monthlyFee: new Map(), // абонемента нет
    feePct: 3,
  }).get("t1")!;
  assert.equal(r.base, 0, "нечего начислять");
  assert.equal(r.paidLessons, 12, "но занятия были — это видно в отчёте");
});

test("без отметок посещаемости зарплата нулевая", () => {
  const r = computePayrollRows({
    teachers: [teacher(3)],
    payable: new Map(),
    monthlyFee: new Map([[feeKey("s1", "math"), 12000]]),
    feePct: 3,
  }).get("t1")!;
  assert.equal(r.salary, 0);
  assert.equal(r.students, 0);
});

test("несколько учеников суммируются", () => {
  const t: PayrollTeacher = { id: "t1", groups: [{ id: "g1", subjectId: "math", lessonsPerWeek: 3, studentIds: ["s1", "s2"] }] };
  const r = computePayrollRows({
    teachers: [t],
    payable: new Map([
      [payableKey("g1", "s1"), 12],
      [payableKey("g1", "s2"), 6],
    ]),
    monthlyFee: new Map([
      [feeKey("s1", "math"), 12000],
      [feeKey("s2", "math"), 12000],
    ]),
    feePct: 0,
  }).get("t1")!;
  assert.equal(r.base, 18000); // 12000 + 6000
  assert.equal(r.students, 2);
  assert.equal(r.paidLessons, 18);
});
