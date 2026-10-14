import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_PHOTO_BYTES, isJpeg, safeFileName, uploadContentType, uploadError } from "./upload-policy.ts";

test("тип берётся из расширения, регистр не важен", () => {
  assert.equal(uploadContentType("Конспект.PDF"), "application/pdf");
  assert.equal(uploadContentType("фото.jpeg"), "image/jpeg");
  assert.equal(uploadContentType("отчёт.xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
});

test("опасные и неизвестные файлы не принимаются", () => {
  for (const n of ["page.html", "x.htm", "logo.svg", "run.js", "a.exe", "без-расширения", "архив.pdf.html"]) {
    assert.equal(uploadContentType(n), null, n);
  }
});

test("ошибки загрузки: пусто, слишком большой, не тот тип", () => {
  assert.equal(uploadError({ name: "a.pdf", size: 0 }), "Файл не выбран");
  assert.match(uploadError({ name: "a.pdf", size: 21 * 1024 * 1024 }) ?? "", /больше 20 МБ/);
  assert.match(uploadError({ name: "a.jpg", size: MAX_PHOTO_BYTES + 1 }, MAX_PHOTO_BYTES) ?? "", /больше 2 МБ/);
  assert.match(uploadError({ name: "a.html", size: 10 }) ?? "", /не поддерживается/);
  assert.equal(uploadError({ name: "a.pdf", size: 10 }), null);
});

test("JPEG узнаётся по сигнатуре", () => {
  assert.equal(isJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), true);
  assert.equal(isJpeg(new TextEncoder().encode("<svg")), false);
  assert.equal(isJpeg(new Uint8Array([0xff])), false);
});

test("имя файла очищается от слэшей", () => {
  assert.equal(safeFileName("../../etc/passwd"), ".._.._etc_passwd");
});
