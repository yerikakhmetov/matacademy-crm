import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCareerLinks } from "./career-test.ts";

const students = [
  { id: "a", name: "Айдос Серікұлы", phone: "+7 (705) 111-22-33" },
  { id: "b", name: "Бота Ахметова", phone: null },
  { id: "c", name: "Ерлан Ким", phone: "+7 (777) 000-00-01" },
  { id: "d", name: "Ерлан Ким", phone: null }, // тёзка без телефона
];

test("профориентация: по телефону в любом виде, затем по имени", () => {
  const r = parseCareerLinks(
    [
      "Аты\tТелефон\tToken", // заголовок пропускаем
      "Айдос Серікұлы\t87051112233\thttps://www.mentorhub.one/t/AAA",
      "бота  ахметова | https://www.mentorhub.one/t/BBB",
    ].join("\n"),
    students,
  );
  assert.deepEqual(r.matched, [
    { studentId: "a", url: "https://www.mentorhub.one/t/AAA" },
    { studentId: "b", url: "https://www.mentorhub.one/t/BBB" },
  ]);
  assert.deepEqual(r.unmatched, []);
});

test("профориентация: тёзки без телефона и незнакомые — в нераспознанные", () => {
  const r = parseCareerLinks(
    ["Ерлан Ким | https://x.one/t/1", "Ерлан Ким | +7 777 000 00 01 | https://x.one/t/2", "Кто-то | 87009998877 | https://x.one/t/3"].join("\n"),
    students,
  );
  assert.deepEqual(r.matched, [{ studentId: "c", url: "https://x.one/t/2" }]);
  assert.equal(r.unmatched.length, 2);
});
