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

// Отмена занятия: кто виноват — видно по делителю.
// Праздник/школа: день выпадает из делителя (12 → 11), месячная доля сохраняется.
// Вина преподавателя: делитель остаётся 12, а посещений 11 — цена одного занятия теряется.
test("отмена не по вине преподавателя не уменьшает зарплату", () => {
  const r = computePayrollRows({
    teachers: [teacher(11)], // 12 по расписанию минус отменённый день
    payable: new Map([[payableKey("g1", "s1"), 11]]),
    monthlyFee: new Map([[feeKey("s1", "math"), 12000]]),
    feePct: 0,
  }).get("t1")!;
  assert.equal(r.base, 12000, "месячная доля целиком");
});

test("отмена по вине преподавателя стоит ему одного занятия", () => {
  const r = computePayrollRows({
    teachers: [teacher(12)], // день остаётся в делителе
    payable: new Map([[payableKey("g1", "s1"), 11]]),
    monthlyFee: new Map([[feeKey("s1", "math"), 12000]]),
    feePct: 0,
  }).get("t1")!;
  assert.equal(r.base, 11000, "12000 − цена одного занятия (1000)");
});

// ---- Ставка предмета ----
// Математика/физика/информатика/география: 8000 ₸ с ученика за 12 занятий,
// то есть 666,67 ₸ за занятие. Оплата ученика на зарплату не влияет.
const RATE = new Map([["math", { amount: 8000, lessons: 12 }]]);

test("ставка: платят за каждое оплачиваемое посещение", () => {
  const r = computePayrollRows({
    teachers: [teacher(12)],
    payable: new Map([[payableKey("g1", "s1"), 12]]),
    monthlyFee: new Map(), // абонемента нет — для ставки это неважно
    rates: RATE,
    feePct: 3,
  }).get("t1")!;
  assert.equal(r.salary, 8000, "12 занятий = полная ставка, без удержания");
  assert.equal(r.studentsWithoutFee, 0, "по ставке «без оплаты» не бывает");
  assert.equal(r.students, 1);
});

test("ставка: пропуск по уважительной причине не оплачивается", () => {
  const r = computePayrollRows({
    teachers: [teacher(12)],
    payable: new Map([[payableKey("g1", "s1"), 11]]), // 1 уважительный пропуск
    monthlyFee: new Map(),
    rates: RATE,
    feePct: 3,
  }).get("t1")!;
  assert.equal(r.salary, Math.round((8000 / 12) * 11));
});

test("ставка: каждый ученик приносит свою сумму", () => {
  const t: PayrollTeacher = { id: "t1", groups: [{ id: "g1", subjectId: "math", scheduledLessons: 12, studentIds: ["s1", "s2", "s3"] }] };
  const r = computePayrollRows({
    teachers: [t],
    payable: new Map([
      [payableKey("g1", "s1"), 12],
      [payableKey("g1", "s2"), 12],
      [payableKey("g1", "s3"), 6],
    ]),
    monthlyFee: new Map(),
    rates: RATE,
    feePct: 3,
  }).get("t1")!;
  assert.equal(r.salary, 8000 + 8000 + 4000);
});

test("ставка не задана — старая модель по доле ученика", () => {
  const r = computePayrollRows({
    teachers: [teacher(12)],
    payable: new Map([[payableKey("g1", "s1"), 12]]),
    monthlyFee: new Map([[feeKey("s1", "math"), 12000]]),
    rates: new Map(), // ставок нет
    feePct: 3,
  }).get("t1")!;
  assert.equal(r.salary, Math.round(12000 * 0.97));
});

// ---------- Куратор ----------
import { computeCuratorRows, curatorRateFor, type PayrollCurator } from "./payroll-calc.ts";

const curator = (groups: PayrollCurator["groups"]): PayrollCurator => ({ id: "c1", groups });
const fees = (...keys: string[]) => new Map(keys.map((k) => [k, 10000]));

test("куратор: ставка за каждый оплаченный предмет ученика", () => {
  const c = curator([
    { id: "g-math", subjectId: "math", studentIds: ["s1"] },
    { id: "g-lit", subjectId: "lit", studentIds: ["s1"] },
    { id: "g-phys", subjectId: "phys", studentIds: ["s1"] },
  ]);
  const r = computeCuratorRows({ curators: [c], monthlyFee: fees(feeKey("s1", "math"), feeKey("s1", "lit"), feeKey("s1", "phys")), defaultRate: 1000 }).get("c1")!;
  assert.equal(r.seats, 3);
  assert.equal(r.students, 1);
  assert.equal(r.salary, 3000);
});

test("куратор: своя ставка предмета важнее общей, 0 = общая", () => {
  const c = curator([
    { id: "g-math", subjectId: "math", studentIds: ["s1"] },
    { id: "g-lit", subjectId: "lit", studentIds: ["s1"] },
  ]);
  const subjectRates = new Map([["lit", 700], ["math", 0]]);
  const r = computeCuratorRows({ curators: [c], monthlyFee: fees(feeKey("s1", "math"), feeKey("s1", "lit")), defaultRate: 1000, subjectRates }).get("c1")!;
  assert.equal(r.salary, 1700);
  assert.equal(curatorRateFor("math", 1000, subjectRates), 1000);
  assert.equal(curatorRateFor("lit", 1000, subjectRates), 700);
});

test("куратор: неоплативший ученик не приносит ставку", () => {
  const c = curator([{ id: "g-math", subjectId: "math", studentIds: ["s1", "s2"] }]);
  const r = computeCuratorRows({ curators: [c], monthlyFee: fees(feeKey("s1", "math")), defaultRate: 1000 }).get("c1")!;
  assert.equal(r.seats, 1);
  assert.equal(r.salary, 1000);
});

test("куратор: один ученик в двух группах одного предмета — одна ставка", () => {
  const c = curator([
    { id: "g1", subjectId: "math", studentIds: ["s1"] },
    { id: "g2", subjectId: "math", studentIds: ["s1"] },
  ]);
  const r = computeCuratorRows({ curators: [c], monthlyFee: fees(feeKey("s1", "math")), defaultRate: 1000 }).get("c1")!;
  assert.equal(r.salary, 1000);
});

test("куратор: группа без предмета и пустой список учеников — ноль", () => {
  const c = curator([{ id: "g1", subjectId: null, studentIds: ["s1"] }, { id: "g2", subjectId: "math", studentIds: [] }]);
  const r = computeCuratorRows({ curators: [c], monthlyFee: fees(feeKey("s1", "math")), defaultRate: 1000 }).get("c1")!;
  assert.equal(r.salary, 0);
  assert.equal(r.bySubject.length, 0);
});

// ---------- Оплаченные счета вместо абонементов ----------
import { monthlyFeesFromPaid, subjectLessonTotals } from "./payroll-calc.ts";
import { paidThrough } from "./payments.ts";

const paid = (o: Partial<Parameters<typeof monthlyFeesFromPaid>[0][number]>) => ({
  studentId: "s1", subjectId: "math", amount: 24000, ratio: 1, year: 2026, month0: 8, months: 1, ...o,
});

test("счёт: доля идёт только в свой месяц", () => {
  const items = [paid({})];
  assert.equal(monthlyFeesFromPaid(items, 2026, 8).get(feeKey("s1", "math")), 24000);
  assert.equal(monthlyFeesFromPaid(items, 2026, 9).get(feeKey("s1", "math")), undefined);
});

test("счёт на 3 месяца делится поровну и не заходит в четвёртый", () => {
  const items = [paid({ amount: 72000, months: 3, month0: 10 })]; // ноябрь–январь
  assert.equal(monthlyFeesFromPaid(items, 2026, 10).get(feeKey("s1", "math")), 24000);
  assert.equal(monthlyFeesFromPaid(items, 2027, 0).get(feeKey("s1", "math")), 24000);
  assert.equal(monthlyFeesFromPaid(items, 2027, 1).get(feeKey("s1", "math")), undefined);
});

test("неоплаченный счёт зарплату не приносит, частичный — пропорционально", () => {
  assert.equal(monthlyFeesFromPaid([paid({ ratio: 0 })], 2026, 8).size, 0);
  assert.equal(monthlyFeesFromPaid([paid({ ratio: 0.5 })], 2026, 8).get(feeKey("s1", "math")), 12000);
});

test("два счёта за один месяц суммируются", () => {
  const fees = monthlyFeesFromPaid([paid({ amount: 10000 }), paid({ amount: 14000 })], 2026, 8);
  assert.equal(fees.get(feeKey("s1", "math")), 24000);
});

const twoTeachers = (): PayrollTeacher[] => [
  { id: "t1", groups: [{ id: "gA", subjectId: "math", scheduledLessons: 12, studentIds: [] }] },
  { id: "t2", groups: [{ id: "gB", subjectId: "math", scheduledLessons: 12, studentIds: ["s1"] }] },
];

test("переход между группами: доля делится по занятиям в каждой", () => {
  const rows = computePayrollRows({
    teachers: twoTeachers(),
    payable: new Map([[payableKey("gA", "s1"), 6], [payableKey("gB", "s1"), 6]]),
    monthlyFee: new Map([[feeKey("s1", "math"), 24000]]),
    feePct: 0,
  });
  assert.equal(rows.get("t1")!.salary, 12000);
  assert.equal(rows.get("t2")!.salary, 12000);
});

test("переход между группами: неравные занятия, сумма не больше доли", () => {
  const rows = computePayrollRows({
    teachers: twoTeachers(),
    payable: new Map([[payableKey("gA", "s1"), 3], [payableKey("gB", "s1"), 6]]),
    monthlyFee: new Map([[feeKey("s1", "math"), 24000]]),
    feePct: 0,
  });
  assert.equal(rows.get("t1")!.salary, 6000); // 3 занятия × 2000
  assert.equal(rows.get("t2")!.salary, 12000); // 6 занятий × 2000
  assert.ok(rows.get("t1")!.salary + rows.get("t2")!.salary <= 24000);
});

test("ушедший из группы ученик: занятия этого месяца всё равно оплачиваются", () => {
  const rows = computePayrollRows({
    teachers: [twoTeachers()[0]], // gA, studentIds пуст
    payable: new Map([[payableKey("gA", "s1"), 4]]),
    monthlyFee: new Map([[feeKey("s1", "math"), 24000]]),
    feePct: 0,
  });
  assert.equal(rows.get("t1")!.salary, 8000);
});

test("subjectLessonTotals: суммирует занятия ученика по всем группам предмета", () => {
  const totals = subjectLessonTotals(
    [{ id: "gA", subjectId: "math" }, { id: "gB", subjectId: "math" }, { id: "gC", subjectId: "phys" }],
    new Map([[payableKey("gA", "s1"), 3], [payableKey("gB", "s1"), 6], [payableKey("gC", "s1"), 5]])
  );
  assert.equal(totals.get(feeKey("s1", "math")), 9);
  assert.equal(totals.get(feeKey("s1", "phys")), 5);
});

test("куратор: ставка делится между группами по занятиям", () => {
  const curators: PayrollCurator[] = [
    { id: "c1", groups: [{ id: "gA", subjectId: "math", studentIds: [] }] },
    { id: "c2", groups: [{ id: "gB", subjectId: "math", studentIds: ["s1"] }] },
  ];
  const rows = computeCuratorRows({
    curators,
    monthlyFee: new Map([[feeKey("s1", "math"), 24000]]),
    defaultRate: 1000,
    payable: new Map([[payableKey("gA", "s1"), 3], [payableKey("gB", "s1"), 9]]),
    allGroups: [{ id: "gA", subjectId: "math" }, { id: "gB", subjectId: "math" }],
  });
  assert.equal(rows.get("c1")!.salary, 250);
  assert.equal(rows.get("c2")!.salary, 750);
});

test("куратор: без отметок ставка целиком группе, где ученик числится", () => {
  const rows = computeCuratorRows({
    curators: [{ id: "c1", groups: [{ id: "gA", subjectId: "math", studentIds: ["s1"] }] }],
    monthlyFee: new Map([[feeKey("s1", "math"), 24000]]),
    defaultRate: 1000,
    payable: new Map(),
    allGroups: [{ id: "gA", subjectId: "math" }],
  });
  assert.equal(rows.get("c1")!.salary, 1000);
});

test("paidThrough: конец последнего полностью оплаченного месяца", () => {
  const d = (y: number, m0: number, day = 1) => new Date(Date.UTC(y, m0, day));
  assert.equal(paidThrough([]), null);
  assert.equal(paidThrough([{ amount: 24000, paidAmount: 12000, date: d(2026, 9), months: 1 }]), null);
  assert.deepEqual(paidThrough([{ amount: 24000, paidAmount: 24000, date: d(2026, 9), months: 1 }]), d(2026, 9, 31));
  assert.deepEqual(
    paidThrough([
      { amount: 24000, paidAmount: 24000, date: d(2026, 8), months: 1 },
      { amount: 72000, paidAmount: 72000, date: d(2026, 9), months: 3 },
    ]),
    d(2026, 11, 31)
  );
});
