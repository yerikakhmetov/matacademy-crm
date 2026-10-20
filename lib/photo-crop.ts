// Квадратная обрезка фото (1:1) в кабинете ученика: фото двигают и увеличивают внутри
// квадратного окна, сохраняется ровно то, что видно в окне. Чистые функции, тесты — photo-crop.test.ts.
//
// view — сторона окна на экране (px); zoom ≥ 1 — во сколько раз больше, чем «впритык по короткой стороне»;
// dx, dy — сдвиг центра фото относительно центра окна (px экрана).

export function coverScale(w: number, h: number, view: number, zoom: number): number {
  return (view / Math.min(w, h)) * Math.max(1, zoom);
}

// Не даём сдвинуть фото так, чтобы в окне появилась пустота.
export function clampOffset(w: number, h: number, view: number, zoom: number, dx: number, dy: number) {
  const s = coverScale(w, h, view, zoom);
  const mx = Math.max(0, (w * s - view) / 2);
  const my = Math.max(0, (h * s - view) / 2);
  return { dx: Math.max(-mx, Math.min(mx, dx)), dy: Math.max(-my, Math.min(my, dy)) };
}

// Какой квадрат исходного фото (в пикселях оригинала) виден в окне.
export function sourceRect(w: number, h: number, view: number, zoom: number, dx: number, dy: number) {
  const s = coverScale(w, h, view, zoom);
  const c = clampOffset(w, h, view, zoom, dx, dy);
  const size = view / s;
  return { sx: (w * s - view) / 2 / s - c.dx / s, sy: (h * s - view) / 2 / s - c.dy / s, size };
}
