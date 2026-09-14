import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TZ_OFFSET_HOURS, isTestOpen, shuffleForSeed, testAvailableAt } from "./tests.ts";

// 3 сентября 2026 — день недели вычисляем, чтобы тест не зависел от календаря в голове
const DATE = new Date(Date.UTC(2026, 8, 3));
const DOW = DATE.getUTCDay() === 0 ? 7 : DATE.getUTCDay();

test("тест открывается во время урока по расписанию (Алматы = UTC+5)", () => {
  const at = testAvailableAt(DATE, [{ dayOfWeek: DOW, startTime: "16:00" }]);
  assert.equal(at.toISOString(), "2026-09-03T11:00:00.000Z"); // 16:00 по Алматы
});

test("если в этот день несколько уроков — берётся самый поздний", () => {
  const at = testAvailableAt(DATE, [
    { dayOfWeek: DOW, startTime: "10:00" },
    { dayOfWeek: DOW, startTime: "16:00" },
  ]);
  assert.equal(at.toISOString(), "2026-09-03T11:00:00.000Z");
});

test("уроки в другие дни недели не влияют", () => {
  const other = DOW === 1 ? 2 : 1;
  const at = testAvailableAt(DATE, [{ dayOfWeek: other, startTime: "16:00" }]);
  // урока в этот день нет → начало дня теста по Алматы
  assert.equal(at.toISOString(), "2026-09-02T19:00:00.000Z");
});

test("isTestOpen: закрыт до урока, открыт после", () => {
  const lessons = [{ dayOfWeek: DOW, startTime: "16:00" }];
  assert.equal(isTestOpen(DATE, lessons, new Date("2026-09-03T10:59:00Z")), false);
  assert.equal(isTestOpen(DATE, lessons, new Date("2026-09-03T11:00:00Z")), true);
  assert.equal(isTestOpen(DATE, lessons, new Date("2026-09-04T08:00:00Z")), true);
});

test("некорректное время урока не ломает расчёт", () => {
  const at = testAvailableAt(DATE, [{ dayOfWeek: DOW, startTime: "" }]);
  assert.equal(Number.isNaN(at.getTime()), false);
});

test("часовой пояс берётся из настроек, а не зашит", () => {
  const lessons = [{ dayOfWeek: DOW, startTime: "16:00" }];
  // UTC+0: урок в 16:00 наступает в 16:00 UTC
  assert.equal(testAvailableAt(DATE, lessons, 0).toISOString(), "2026-09-03T16:00:00.000Z");
  // UTC+6 — на час раньше, чем при UTC+5
  assert.equal(testAvailableAt(DATE, lessons, 6).toISOString(), "2026-09-03T10:00:00.000Z");
  // по умолчанию — Алматы
  assert.equal(DEFAULT_TZ_OFFSET_HOURS, 5);
  assert.equal(
    testAvailableAt(DATE, lessons).toISOString(),
    testAvailableAt(DATE, lessons, DEFAULT_TZ_OFFSET_HOURS).toISOString()
  );
});

test("isTestOpen учитывает переданный часовой пояс", () => {
  const lessons = [{ dayOfWeek: DOW, startTime: "16:00" }];
  const t = new Date("2026-09-03T12:00:00Z");
  assert.equal(isTestOpen(DATE, lessons, t, 5), true);  // урок был в 11:00 UTC
  assert.equal(isTestOpen(DATE, lessons, t, 0), false); // урок будет в 16:00 UTC
});

test("shuffleForSeed: порядок стабилен для одного ученика и различается у разных", () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8];
  const a1 = shuffleForSeed(items, "test1|student1");
  const a2 = shuffleForSeed(items, "test1|student1");
  const b = shuffleForSeed(items, "test1|student2");
  assert.deepEqual(a1, a2, "обновление страницы не меняет порядок");
  assert.notDeepEqual(a1, b, "у другого ученика другой порядок");
  assert.deepEqual([...a1].sort((x, y) => x - y), items, "ничего не потеряно и не задвоено");
  assert.equal(a1.length, items.length);
});

test("shuffleForSeed: не портит исходный массив и работает на пустом", () => {
  const items = [1, 2, 3];
  const copy = [...items];
  shuffleForSeed(items, "seed");
  assert.deepEqual(items, copy);
  assert.deepEqual(shuffleForSeed([], "seed"), []);
});

// --- Ручное открытие доступа ---
const LESSONS = [{ dayOfWeek: 3, startTime: "14:30" }]; // среда, 14:30
const WED = new Date("2026-09-09T00:00:00Z"); // среда

test("по расписанию тест закрыт до конца урока и открыт после", () => {
  assert.equal(isTestOpen(WED, LESSONS, new Date("2026-09-09T08:00:00Z"), 5), false, "13:00 по школе — рано");
  assert.equal(isTestOpen(WED, LESSONS, new Date("2026-09-09T10:00:00Z"), 5), true, "15:00 по школе — можно");
});

test("выставленный вручную момент главнее расписания", () => {
  const now = new Date("2026-09-09T08:00:00Z"); // урок ещё не прошёл
  assert.equal(isTestOpen(WED, LESSONS, now, 5), false);
  assert.equal(
    isTestOpen(WED, LESSONS, now, 5, new Date("2026-09-09T07:00:00Z")),
    true,
    "открыли раньше урока — тест доступен"
  );
});

test("тест для прошедшего урока открывается сразу", () => {
  // тест завели сегодня, а урок был на прошлой неделе: по расписанию он ждал бы
  // следующей среды, вручную открывается немедленно
  const today = new Date("2026-09-14T06:00:00Z"); // понедельник
  assert.equal(isTestOpen(today, LESSONS, today, 5), true, "в день без урока — с начала дня");
  const tomorrowLesson = new Date("2026-09-16T00:00:00Z"); // среда
  assert.equal(isTestOpen(tomorrowLesson, LESSONS, today, 5), false);
  assert.equal(isTestOpen(tomorrowLesson, LESSONS, today, 5, today), true);
});

test("момент открытия в будущем держит тест закрытым", () => {
  const now = new Date("2026-09-09T10:00:00Z"); // по расписанию уже открыт
  assert.equal(isTestOpen(WED, LESSONS, now, 5), true);
  assert.equal(
    isTestOpen(WED, LESSONS, now, 5, new Date("2026-09-20T00:00:00Z")),
    false,
    "вручную отложили — расписание не перебивает"
  );
});

test("testAvailableAt возвращает выставленный момент как есть", () => {
  const at = new Date("2026-09-09T07:00:00Z");
  assert.equal(testAvailableAt(WED, LESSONS, 5, at).getTime(), at.getTime());
});
