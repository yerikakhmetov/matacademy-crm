import { test } from "node:test";
import assert from "node:assert/strict";
import { isNormalized, localDigits, normalizePhone, normalizePhoneOrNull } from "./phone.ts";

const STD = "+7 (705) 123-45-67";

test("разные записи одного номера дают один результат", () => {
  for (const raw of [
    "87051234567",
    "8 705 123 45 67",
    "+77051234567",
    "+7 705 123-45-67",
    "7051234567",
    "705 123 45 67",
    "+7 (705) 123-45-67",
    "8-705-123-45-67",
  ]) {
    assert.equal(normalizePhone(raw), STD, `не сошлось: ${raw}`);
  }
});

test("именно это чинит скидку «брат/сестра»", () => {
  // до приведения строки разные — поиск родителя по равенству ничего не находил
  assert.notEqual("87051234567", "+7 705 123 45 67");
  assert.equal(normalizePhone("87051234567"), normalizePhone("+7 705 123 45 67"));
});

test("пустое значение остаётся пустым", () => {
  assert.equal(normalizePhone(""), "");
  assert.equal(normalizePhone("   "), "");
  assert.equal(normalizePhone(null), "");
  assert.equal(normalizePhone(undefined), "");
  assert.equal(normalizePhoneOrNull(""), null);
  assert.equal(normalizePhoneOrNull("87051234567"), STD);
});

test("чужой формат не ломаем — возвращаем как есть", () => {
  assert.equal(normalizePhone("+996 555 11 22 33"), "+996 555 11 22 33");
  assert.equal(normalizePhone("123"), "123");
  assert.equal(normalizePhone("не знаю"), "не знаю");
  assert.equal(normalizePhone("+7 705 123 45 67 доб. 12"), "+7 705 123 45 67 доб. 12");
});

test("лишние пробелы схлопываются", () => {
  assert.equal(normalizePhone("  +996   555   11  "), "+996 555 11");
});

test("localDigits вытаскивает десятку", () => {
  assert.equal(localDigits("87051234567"), "7051234567");
  assert.equal(localDigits("+77051234567"), "7051234567");
  assert.equal(localDigits("7051234567"), "7051234567");
  assert.equal(localDigits("123456789"), null, "девять цифр — не номер");
  assert.equal(localDigits("991234567890"), null, "двенадцать цифр — не наш формат");
});

test("одиннадцать цифр не с 7 и не с 8 не трогаем", () => {
  assert.equal(localDigits("91234567890"), null);
  assert.equal(normalizePhone("91234567890"), "91234567890");
});

test("isNormalized узнаёт стандарт", () => {
  assert.ok(isNormalized(STD));
  assert.ok(!isNormalized("87051234567"));
  assert.ok(!isNormalized("+7 705 123-45-67"));
});
