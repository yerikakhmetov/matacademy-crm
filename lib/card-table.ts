import type { CSSProperties } from "react";

// Таблица, которая на телефоне (до 760px) показывается карточками: «столбец: значение».
// Подписи передаём CSS-переменными (--c1, --c2…) прямо в серверном HTML — без клиентского
// JS и без расхождений при гидратации. Первая ячейка — заголовок карточки, без подписи.
// false/null/undefined — столбца сейчас нет (условный столбец), "" — столбец без подписи.
export function cardCols(labels: (string | false | null | undefined)[]): { className: string; style: CSSProperties } {
  const style: Record<string, string> = {};
  labels
    .filter((l): l is string => typeof l === "string")
    .forEach((l, i) => {
      style[`--c${i + 1}`] = l ? JSON.stringify(l) : "none";
    });
  return { className: "mcards", style: style as CSSProperties };
}
