import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIcs, icsEscape, nextOccurrence } from "./ics.ts";

const NOW = new Date("2026-09-05T10:00:00Z"); // суббота

test("nextOccurrence находит ближайший нужный день недели", () => {
  // 2026-09-05 — суббота (6)
  assert.equal(nextOccurrence(NOW, 6).toISOString().slice(0, 10), "2026-09-05", "сегодня подходит");
  assert.equal(nextOccurrence(NOW, 1).toISOString().slice(0, 10), "2026-09-07", "ближайший понедельник");
  assert.equal(nextOccurrence(NOW, 5).toISOString().slice(0, 10), "2026-09-11", "пятница — уже на следующей неделе");
});

test("buildIcs: время урока переводится из часового пояса школы в UTC", () => {
  const ics = buildIcs(
    [{ uid: "l1@x", summary: "Алгебра", location: "Каб. 3", dayOfWeek: 1, startTime: "16:00", durationMin: 60 }],
    { name: "МатАкадемия", tzOffsetHours: 5, from: NOW, now: NOW }
  );
  assert.ok(ics.includes("DTSTART:20260907T110000Z"), "16:00 по Алматы = 11:00 UTC");
  assert.ok(ics.includes("DTEND:20260907T120000Z"), "плюс час");
  assert.ok(ics.includes("RRULE:FREQ=WEEKLY;BYDAY=MO"));
  assert.ok(ics.includes("LOCATION:Каб. 3"));
});

test("buildIcs: структура календаря корректна и строки через CRLF", () => {
  const ics = buildIcs(
    [{ uid: "a@x", summary: "A", dayOfWeek: 3, startTime: "09:30", durationMin: 90 }],
    { name: "Школа", tzOffsetHours: 0, from: NOW, now: NOW }
  );
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.trimEnd().endsWith("END:VCALENDAR"));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.equal((ics.match(/END:VEVENT/g) || []).length, 1);
  assert.ok(ics.includes("DTEND:20260909T110000Z"), "09:30 + 90 мин = 11:00");
});

test("icsEscape экранирует служебные символы", () => {
  assert.equal(icsEscape("Алгебра, 7 класс"), "Алгебра\\, 7 класс");
  assert.equal(icsEscape("A;B"), "A\\;B", "точка с запятой экранируется по спецификации");
  assert.equal(icsEscape("строка\nвторая"), "строка\\nвторая");
});

test("buildIcs без событий возвращает пустой, но валидный календарь", () => {
  const ics = buildIcs([], { name: "Школа", tzOffsetHours: 5, from: NOW, now: NOW });
  assert.ok(ics.includes("BEGIN:VCALENDAR"));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 0);
});
