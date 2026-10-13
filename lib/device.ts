// Короткое описание устройства для подтверждения входа в боте: «Chrome · macOS · Алматы».
// Чистая функция (без БД), покрыта тестами в device.test.ts.

function browserOf(ua: string): string | null {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/YaBrowser\//.test(ua)) return "Яндекс Браузер";
  if (/SamsungBrowser\//.test(ua)) return "Samsung Internet";
  if (/Firefox\/|FxiOS\//.test(ua)) return "Firefox";
  if (/Chrome\/|CriOS\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return null;
}

function osOf(ua: string): string | null {
  if (/iPhone|iPod/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return null;
}

export function describeDevice(userAgent: string | null, city: string | null, ip: string | null): string {
  const ua = userAgent ?? "";
  let place: string | null = null;
  if (city) {
    try {
      place = decodeURIComponent(city);
    } catch {
      place = city;
    }
  }
  const parts = [browserOf(ua), osOf(ua), place ?? (ip ? `IP ${ip}` : null)].filter(Boolean);
  return parts.length ? parts.join(" · ").slice(0, 120) : "неизвестное устройство";
}

// Токен входа: 32 hex-символа (crypto.randomUUID без дефисов). Всё остальное — мусор.
export const isLoginToken = (t: string) => /^[a-f0-9]{32}$/.test(t);
