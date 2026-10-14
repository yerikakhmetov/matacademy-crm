import { test } from "node:test";
import assert from "node:assert/strict";
import { frequentAbsentees } from "./curator-home.ts";

const m = (studentId: string, present: boolean, excused = false) => ({ studentId, present, excused });

test("часто пропускающие: от двух пропусков, присутствие не считается", () => {
  const r = frequentAbsentees([m("a", false), m("a", false), m("a", true), m("b", false), m("c", true)]);
  assert.deepEqual(r, [{ studentId: "a", missed: 2, unexcused: 2 }]);
});

test("уважительные пропуски считаются, но прогулы без причины — выше в списке", () => {
  const r = frequentAbsentees([
    m("ok", false, true), m("ok", false, true), m("ok", false, true),
    m("bad", false), m("bad", false),
  ]);
  assert.deepEqual(r.map((x) => x.studentId), ["bad", "ok"]);
  assert.equal(r[1].missed, 3);
  assert.equal(r[1].unexcused, 0);
});

test("порог настраивается, пусто — пустой список", () => {
  assert.equal(frequentAbsentees([m("a", false)], 1).length, 1);
  assert.deepEqual(frequentAbsentees([]), []);
});
