import { test } from "node:test";
import assert from "node:assert/strict";
import { cardCols } from "./card-table.ts";

test("условные столбцы выпадают, нумерация идёт по фактическим столбцам", () => {
  const r = cardCols(["Ученик", false, "Сумма", ""]);
  assert.equal(r.className, "mcards");
  assert.deepEqual(r.style, { "--c1": '"Ученик"', "--c2": '"Сумма"', "--c3": "none" });
});

test("кавычки в подписи экранируются", () => {
  assert.equal((cardCols(['Тест "А"']).style as Record<string, string>)["--c1"], '"Тест \\"А\\""');
});
