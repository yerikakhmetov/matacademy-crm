import { test } from "node:test";
import assert from "node:assert/strict";
import { lessonStatus, minutesUntil, nextLessonAfterToday, pickFocus } from "./teacher-today.ts";

const L = (id: string, startTime: string, o: { marked?: boolean; cancelled?: boolean } = {}) => ({
  id,
  startTime,
  marked: o.marked ?? false,
  cancelled: o.cancelled ?? false,
});

test("статус: отменено и отмечено важнее времени", () => {
  assert.equal(lessonStatus(L("a", "09:00", { cancelled: true }), "12:00"), "cancelled");
  assert.equal(lessonStatus(L("a", "09:00", { marked: true }), "12:00"), "marked");
});

test("статус: началось и не отмечено — due, ещё не началось — upcoming", () => {
  assert.equal(lessonStatus(L("a", "15:00"), "15:00"), "due");
  assert.equal(lessonStatus(L("a", "15:00"), "14:59"), "upcoming");
});

test("фокус: сначала самое раннее неотмеченное из начавшихся", () => {
  const f = pickFocus([L("late", "17:00"), L("a", "10:00"), L("b", "13:00")], "14:00");
  assert.equal(f?.lesson.id, "a");
  assert.equal(f?.status, "due");
});

test("фокус: всё отмечено — ближайшее предстоящее", () => {
  const f = pickFocus([L("a", "10:00", { marked: true }), L("b", "17:00"), L("c", "15:30")], "14:00");
  assert.equal(f?.lesson.id, "c");
  assert.equal(f?.status, "upcoming");
});

test("фокус: отмечено и отменено всё — нет фокуса", () => {
  assert.equal(pickFocus([L("a", "10:00", { marked: true }), L("b", "17:00", { cancelled: true })], "18:00"), null);
});

test("минут до начала", () => {
  assert.equal(minutesUntil("15:00", "14:20"), 40);
  assert.equal(minutesUntil("15:00", "15:10"), -10);
});

test("следующее занятие: ближайший день после сегодня, раньше по времени", () => {
  const ls = [
    { dayOfWeek: 1, startTime: "15:00" },
    { dayOfWeek: 5, startTime: "17:00" },
    { dayOfWeek: 5, startTime: "09:00" },
  ];
  // сегодня среда (3) → пятница, 9:00
  assert.deepEqual(nextLessonAfterToday(ls, 3), { lesson: ls[2], daysAhead: 2 });
  // сегодня пятница → понедельник (занятие сегодня не считается «следующим днём»)
  assert.deepEqual(nextLessonAfterToday(ls, 5), { lesson: ls[0], daysAhead: 3 });
  assert.equal(nextLessonAfterToday([], 3), null);
});
