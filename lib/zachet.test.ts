import { test } from "node:test";
import assert from "node:assert/strict";
import { schoolDateTimeToUtc, utcToSchoolParts, zachetStatus, zachetSummary, zachetAgenda } from "./zachet.ts";

test("дата и время по часам школы → момент UTC и обратно", () => {
  const at = schoolDateTimeToUtc("2026-10-20", "15:30", 5)!;
  assert.equal(at.toISOString(), "2026-10-20T10:30:00.000Z");
  assert.deepEqual(utcToSchoolParts(at, 5), { date: "2026-10-20", time: "15:30" });
  // ранним утром по Алматы это ещё вчера по UTC
  assert.equal(schoolDateTimeToUtc("2026-10-20", "02:00", 5)!.toISOString(), "2026-10-19T21:00:00.000Z");
});

test("кривой ввод даты/времени — null", () => {
  assert.equal(schoolDateTimeToUtc("20.10.2026", "15:30", 5), null);
  assert.equal(schoolDateTimeToUtc("2026-10-20", "25:00", 5), null);
  assert.equal(schoolDateTimeToUtc("2026-13-01", "10:00", 5), null);
  assert.equal(schoolDateTimeToUtc("", "", 5), null);
});

test("состояние зачёта для ученика", () => {
  const at = new Date("2026-10-20T10:30:00Z");
  assert.equal(zachetStatus(at, { passed: true }), "passed");
  assert.equal(zachetStatus(at, { passed: false }), "failed");
  assert.equal(zachetStatus(at, null, new Date("2026-10-19T00:00:00Z")), "upcoming");
  assert.equal(zachetStatus(at, null, new Date("2026-10-21T00:00:00Z")), "pending");
});

test("сводка по группе", () => {
  const s = zachetSummary(["a", "b", "c", "d"], [
    { studentId: "a", passed: true },
    { studentId: "b", passed: false },
    { studentId: "x", passed: true }, // ушёл из группы — не считается
  ]);
  assert.deepEqual(s, { passed: 1, failed: 1, unmarked: 2, total: 4 });
});

test("повестка куратора: ближайшие за неделю и прошедшие без отметок", () => {
  const now = new Date("2026-10-19T06:00:00Z");
  const z = (id: string, at: string, studentIds: string[], marked: string[] = []) => ({
    id,
    scheduledAt: new Date(at),
    studentIds,
    results: marked.map((studentId) => ({ studentId, passed: true })),
  });
  const { upcoming, toMark } = zachetAgenda(
    [
      z("later", "2026-10-30T10:00:00Z", ["a"]), // дальше недели — не показываем
      z("soon2", "2026-10-22T10:00:00Z", ["a"]),
      z("soon1", "2026-10-20T10:00:00Z", ["a"]),
      z("done", "2026-10-15T10:00:00Z", ["a", "b"], ["a", "b"]), // всё отмечено — не показываем
      z("half", "2026-10-16T10:00:00Z", ["a", "b"], ["a"]),
      z("old", "2026-10-01T10:00:00Z", ["a"]),
    ],
    now,
  );
  assert.deepEqual(upcoming.map((x) => x.id), ["soon1", "soon2"]);
  assert.deepEqual(toMark.map((x) => x.id), ["old", "half"]);
  assert.equal(toMark[1].summary.unmarked, 1);
});
