import { test } from "node:test";
import { strict as assert } from "node:assert";
import { canTeacherManageTest } from "./test-policy.ts";

test("teacher manages tests of their subject across groups", () => {
  const scope = { subjectIds: ["math"], ownGroupIds: ["m1"] };
  assert.equal(canTeacherManageTest({ subjectId: "math", groupId: "m2" }, scope), true);
  assert.equal(canTeacherManageTest({ subjectId: "physics", groupId: "m1" }, scope), false);
  assert.equal(canTeacherManageTest({ subjectId: null, groupId: "m1" }, scope), true);
  assert.equal(canTeacherManageTest({ subjectId: null, groupId: "m2" }, scope), false);
});
