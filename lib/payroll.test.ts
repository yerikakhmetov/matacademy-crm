import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computePayrollRows,
  feeKey,
  isPayableAttendance,
  payableKey,
  scheduledLessonsInMonth,
  weekdayOccurrences,
  type PayrollTeacher,
} from "./payroll-calc.ts";

const teacher = (scheduledLessons: number, subjectId: string | null = "math"): PayrollTeacher => ({
  id: "t1",
  groups: [{ id: "g1", subjectId, scheduledLessons, studentIds: ["s1"] }],
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

test("12 занятий в месяце: полный месяц даёт всю долю минус 3%", () => {
  const r = run(teacher(12), 12, 12000);
  assert.equal(r.base, 12000);
  assert.equal(r.salary, 11640); // 12000 − 3%
  assert.equal(r.paidLessons, 12);
  assert.equal(r.students, 1);
});

test("8 занятий в месяце: делитель 8", () => {
  const r = run(teacher(8), 8, 8000);
  assert.equal(r.base, 8000);
});

test("пропущенные занятия уменьшают начисление пропорционально", () => {
  const r = run(teacher(12), 10, 12000); // 10 из 12
  assert.equal(r.base, 10000);
  assert.equal(r.paidLessons, 10);
});

test("удержание школы 0% — к выплате равно начисленному", () => {
  const r = run(teacher(12), 12, 12000, 0);
  assert.equal(r.salary, r.base);
});

test("группа без предмета не приносит зарплату", () => {
  const r = run(teacher(12, null), 12, 12000);
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
    teachers: [teacher(12)],
    payable: new Map([[payableKey("g1", "s1"), 12]]),
    monthlyFee: new Map(), // абонемента нет
    feePct: 3,
  }).get("t1")!;
  assert.equal(r.base, 0, "нечего начислять");
  assert.equal(r.paidLessons, 12, "но занятия были — это видно в отчёте");
});

test("без отметок посещаемости зарплата нулевая", () => {
  const r = computePayrollRows({
    teachers: [teacher(12)],
    payable: new Map(),
    monthlyFee: new Map([[feeKey("s1", "math"), 12000]]),
    feePct: 3,
  }).get("t1")!;
  assert.equal(r.salary, 0);
  assert.equal(r.students, 0);
});

test("несколько учеников суммируются", () => {
  const t: PayrollTeacher = { id: "t1", groups: [{ id: "g1", subjectId: "math", scheduledLessons: 12, studentIds: ["s1", "s2"] }] };
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

test("месяц с пятой неделей: ученик не стоит больше своей месячной доли", () => {
  // 15 занятий по расписанию, ученик пришёл на все — начисляем ровно месячную долю
  const r = run(teacher(15), 15, 12000, 0);
  assert.equal(r.base, 12000);
});

test("студент без месячной доли попадает в предупреждение", () => {
  const r = computePayrollRows({
    teachers: [teacher(12)],
    payable: new Map([[payableKey("g1", "s1"), 12]]),
    monthlyFee: new Map(),
    feePct: 3,
  }).get("t1")!;
  assert.equal(r.studentsWithoutFee, 1);
  assert.equal(r.students, 0);
});

test("weekdayOccurrences: сентябрь 2026 — 5 четвергов", () => {
  // 2026-09-01 — вторник, значит четвергов 3, 10, 17, 24 → 4
  assert.equal(weekdayOccurrences(2026, 8, 4), 4);
  assert.equal(weekdayOccurrences(2026, 8, 2), 5); // вторники: 1, 8, 15, 22, 29
});

test("scheduledLessonsInMonth: 3 занятия в неделю дают 12-15 в месяц", () => {
  const n = scheduledLessonsInMonth(2026, 8, [1, 3, 5]);
  assert.ok(n >= 12 && n <= 15, `ожидали 12-15, получили ${n}`);
});

// --- Дата начала группы ---
// Сентябрь 2026: 1-е — вторник. Среды: 2, 9, 16, 23, 30.
test("до даты начала занятий по расписанию нет", () => {
  assert.equal(weekdayOccurrences(2026, 8, 3), 5, "всего 5 сред в сентябре 2026");
  // группа М-1 стартует 9 сентября — первая среда (2-е) не считается
  assert.equal(weekdayOccurrences(2026, 8, 3, new Date(Date.UTC(2026, 8, 9))), 4);
});

test("дата начала попадает ровно на день занятия — этот день считается", () => {
  const start = new Date(Date.UTC(2026, 8, 9)); // среда
  assert.equal(weekdayOccurrences(2026, 8, 3, start), 4, "9-е входит в счёт");
});

test("группа стартует в следующем месяце — в этом занятий нет", () => {
  const start = new Date(Date.UTC(2026, 9, 1));
  assert.equal(scheduledLessonsInMonth(2026, 8, [1, 3, 5], start), 0);
});

test("группа началась раньше месяца — считаем весь месяц", () => {
  const start = new Date(Date.UTC(2025, 0, 15));
  assert.equal(
    scheduledLessonsInMonth(2026, 8, [1, 3, 5], start),
    scheduledLessonsInMonth(2026, 8, [1, 3, 5]),
    "старая группа считается как раньше"
  );
});

test("без даты начала поведение прежнее", () => {
  assert.equal(scheduledLessonsInMonth(2026, 8, [1, 3, 5], null), scheduledLessonsInMonth(2026, 8, [1, 3, 5]));
});

test("первый месяц новой группы: делитель меньше, значит занятие дороже", () => {
  const full = scheduledLessonsInMonth(2026, 8, [1, 3, 5]); // 13 занятий
  const partial = scheduledLessonsInMonth(2026, 8, [1, 3, 5], new Date(Date.UTC(2026, 8, 9)));
  assert.ok(partial < full, "часть месяца группа ещё не занималась");
  assert.equal(partial, 10);
});
