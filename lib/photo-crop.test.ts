import { test } from "node:test";
import assert from "node:assert/strict";
import { clampOffset, sourceRect } from "./photo-crop.ts";

test("обрезка 1:1: без сдвига и увеличения — центральный квадрат по короткой стороне", () => {
  assert.deepEqual(sourceRect(1200, 800, 300, 1, 0, 0), { sx: 200, sy: 0, size: 800 });
  assert.deepEqual(sourceRect(600, 900, 300, 1, 0, 0), { sx: 0, sy: 150, size: 600 });
});

test("обрезка 1:1: сдвиг вправо показывает левую часть, лишний сдвиг упирается в край", () => {
  // 1200×800 в окне 300: масштаб 0.375, запас по ширине (450−300)/2 = 75 px экрана
  assert.deepEqual(clampOffset(1200, 800, 300, 1, 500, 40), { dx: 75, dy: 0 });
  assert.deepEqual(sourceRect(1200, 800, 300, 1, 75, 0), { sx: 0, sy: 0, size: 800 });
});

test("обрезка 1:1: увеличение ×2 — квадрат вдвое меньше", () => {
  const r = sourceRect(1000, 1000, 250, 2, 0, 0);
  assert.equal(r.size, 500);
  assert.equal(r.sx, 250);
  assert.equal(r.sy, 250);
});
