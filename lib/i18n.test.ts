import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LOCALE, dayShort, isLocale, LOCALES, t } from "./i18n.ts";

test("переводы есть на всех языках и не совпадают дословно", () => {
  for (const l of LOCALES) {
    assert.equal(typeof t(l, "cabinet.schedule"), "string");
    assert.ok(t(l, "cabinet.schedule").length > 0);
  }
  assert.notEqual(t("ru", "cabinet.schedule"), t("kk", "cabinet.schedule"));
});

test("подстановка переменных работает в обоих языках", () => {
  assert.equal(t("ru", "cabinet.lastN", { n: 5 }), "последние 5");
  assert.equal(t("kk", "cabinet.lastN", { n: 5 }), "соңғы 5");
  assert.ok(t("kk", "test.ofCorrect", { correct: 8, total: 10 }).includes("8"));
});

test("неизвестная переменная остаётся видимой, а не превращается в undefined", () => {
  assert.equal(t("ru", "cabinet.lastN", {}), "последние {n}");
});

test("isLocale отсекает мусор из куки", () => {
  assert.equal(isLocale("kk"), true);
  assert.equal(isLocale("ru"), true);
  assert.equal(isLocale("en"), false);
  assert.equal(isLocale(null), false);
  assert.equal(DEFAULT_LOCALE, "ru");
});

test("дни недели переведены и не съезжают по индексам", () => {
  assert.equal(dayShort("ru", 1), "Пн");
  assert.equal(dayShort("kk", 1), "Дс");
  assert.equal(dayShort("kk", 5), "Жм");
  assert.equal(dayShort("kk", 6), "Сб");
  assert.equal(dayShort("kk", 0), "", "нулевой индекс не используется");
});
