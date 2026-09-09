import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTime, parseSlots, planScheduleSync } from "./schedule-sync.ts";

test("время приводится к HH:MM, мусор отбрасывается", () => {
  assert.equal(normalizeTime("9:5"), "09:05");
  assert.equal(normalizeTime(" 14:30 "), "14:30");
  assert.equal(normalizeTime("24:00"), null);
  assert.equal(normalizeTime("12:60"), null);
  assert.equal(normalizeTime("полдень"), null);
});

test("parseSlots чистит ввод: дубли, кривые дни и время", () => {
  const slots = parseSlots(
    JSON.stringify([
      { dayOfWeek: 3, startTime: "14:30", room: "Каб. 2" },
      { dayOfWeek: 3, startTime: "14:30", room: "Каб. 2" }, // дубль
      { dayOfWeek: 0, startTime: "10:00", room: "Каб. 1" }, // воскресенья нет
      { dayOfWeek: 2, startTime: "щас", room: "Каб. 1" }, // мусорное время
      { dayOfWeek: 1, startTime: "9:00", room: "" }, // пустой кабинет → запасной
    ])
  );
  assert.deepEqual(slots, [
    { dayOfWeek: 1, startTime: "09:00", room: "Каб. 1" },
    { dayOfWeek: 3, startTime: "14:30", room: "Каб. 2" },
  ]);
});

test("битый JSON не роняет сохранение", () => {
  assert.deepEqual(parseSlots("{не json"), []);
  assert.deepEqual(parseSlots(null), []);
});

test("совпадающий слот не трогаем", () => {
  const plan = planScheduleSync(
    [{ id: "a", dayOfWeek: 1, startTime: "14:30", room: "Каб. 1" }],
    [{ dayOfWeek: 1, startTime: "14:30", room: "Каб. 1" }]
  );
  assert.deepEqual(plan, { create: [], update: [], remove: [] });
});

test("смена времени в тот же день — обновление, а не пересоздание", () => {
  const plan = planScheduleSync(
    [{ id: "a", dayOfWeek: 1, startTime: "14:30", room: "Каб. 1" }],
    [{ dayOfWeek: 1, startTime: "16:00", room: "Каб. 1" }]
  );
  assert.deepEqual(plan.remove, [], "занятие не удаляем — иначе пропадёт посещаемость");
  assert.deepEqual(plan.create, []);
  assert.deepEqual(plan.update, [{ id: "a", dayOfWeek: 1, startTime: "16:00", room: "Каб. 1" }]);
});

test("смена только кабинета — обновление", () => {
  const plan = planScheduleSync(
    [{ id: "a", dayOfWeek: 1, startTime: "14:30", room: "Каб. 1" }],
    [{ dayOfWeek: 1, startTime: "14:30", room: "Каб. 3" }]
  );
  assert.deepEqual(plan.update, [{ id: "a", dayOfWeek: 1, startTime: "14:30", room: "Каб. 3" }]);
});

test("перенос на другой день переиспользует занятие", () => {
  const plan = planScheduleSync(
    [{ id: "a", dayOfWeek: 1, startTime: "14:30", room: "Каб. 1" }],
    [{ dayOfWeek: 4, startTime: "14:30", room: "Каб. 1" }]
  );
  assert.deepEqual(plan.create, []);
  assert.deepEqual(plan.remove, []);
  assert.deepEqual(plan.update, [{ id: "a", dayOfWeek: 4, startTime: "14:30", room: "Каб. 1" }]);
});

test("добавление и удаление слотов", () => {
  const plan = planScheduleSync(
    [
      { id: "a", dayOfWeek: 1, startTime: "14:30", room: "Каб. 1" },
      { id: "b", dayOfWeek: 3, startTime: "14:30", room: "Каб. 1" },
    ],
    [
      { dayOfWeek: 1, startTime: "14:30", room: "Каб. 1" },
      { dayOfWeek: 3, startTime: "14:30", room: "Каб. 1" },
      { dayOfWeek: 5, startTime: "14:30", room: "Каб. 1" },
    ]
  );
  assert.deepEqual(plan.create, [{ dayOfWeek: 5, startTime: "14:30", room: "Каб. 1" }]);
  assert.deepEqual(plan.remove, []);

  const plan2 = planScheduleSync(
    [
      { id: "a", dayOfWeek: 1, startTime: "14:30", room: "Каб. 1" },
      { id: "b", dayOfWeek: 3, startTime: "14:30", room: "Каб. 1" },
    ],
    [{ dayOfWeek: 1, startTime: "14:30", room: "Каб. 1" }]
  );
  assert.deepEqual(plan2.remove, ["b"]);
  assert.deepEqual(plan2.create, []);
});

test("два занятия в один день различаются по времени", () => {
  const plan = planScheduleSync(
    [
      { id: "a", dayOfWeek: 2, startTime: "10:00", room: "Каб. 1" },
      { id: "b", dayOfWeek: 2, startTime: "18:00", room: "Каб. 1" },
    ],
    [
      { dayOfWeek: 2, startTime: "10:00", room: "Каб. 1" },
      { dayOfWeek: 2, startTime: "19:00", room: "Каб. 1" },
    ]
  );
  assert.deepEqual(plan.create, []);
  assert.deepEqual(plan.remove, []);
  assert.deepEqual(plan.update, [{ id: "b", dayOfWeek: 2, startTime: "19:00", room: "Каб. 1" }]);
});

test("пустое расписание убирает все занятия", () => {
  const plan = planScheduleSync([{ id: "a", dayOfWeek: 1, startTime: "14:30", room: "Каб. 1" }], []);
  assert.deepEqual(plan.remove, ["a"]);
});
