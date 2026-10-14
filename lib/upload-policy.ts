// Какие файлы можно загружать в CRM (материалы, домашние работы, фото).
// Тип содержимого берём из расширения по белому списку, а не из того, что прислал
// браузер: иначе можно загрузить HTML или SVG со скриптом и раздавать его по ссылке.
// Чистые функции, покрыты тестами в upload-policy.test.ts.

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // материалы и домашние работы
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // фото уже сжато в браузере до 512px

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  gif: "image/gif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain; charset=utf-8",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
};

// Для <input type="file" accept>: браузер сразу предлагает только подходящие файлы.
export const UPLOAD_ACCEPT = Object.keys(TYPES).map((e) => "." + e).join(",");

const extOf = (name: string) => (name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "");

// Тип содержимого для сохранения, или null — такой файл не принимаем.
export function uploadContentType(fileName: string): string | null {
  return TYPES[extOf(fileName)] ?? null;
}

export function uploadError(file: { name: string; size: number }, max = MAX_UPLOAD_BYTES): string | null {
  if (file.size === 0) return "Файл не выбран";
  if (file.size > max) return `Файл больше ${Math.round(max / 1024 / 1024)} МБ`;
  if (!uploadContentType(file.name)) return "Такой тип файла не поддерживается: загрузите PDF, фото, документ Word/Excel/PowerPoint, текст, видео или аудио";
  return null;
}

// Фото ученика/преподавателя браузер всегда пересжимает в JPEG — проверяем по сигнатуре FF D8 FF.
export function isJpeg(head: Uint8Array): boolean {
  return head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
}

// Имя файла для пути в хранилище: без слэшей и служебных символов.
export function safeFileName(name: string): string {
  return name.replace(/[^\w.\-А-Яа-яЁё ]+/g, "_").slice(0, 120);
}
