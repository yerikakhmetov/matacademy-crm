// Готовая разметка формулы (её собирает renderMath на сервере).
// Компонент только вставляет её — библиотека в клиентский бандл не попадает.
// Имя не Math: так называется встроенный объект JS, и импорт перекрыл бы Math.floor.
export function Formula({ html, style }: { html: string; style?: React.CSSProperties }) {
  return <span style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}
