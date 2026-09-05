import { cookies } from "next/headers";
import { getSettings } from "./settings";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./i18n";

export const LOCALE_COOKIE = "locale";

// Язык страницы: выбор посетителя (кука) важнее языка школы по умолчанию.
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const fromCookie = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const s = await getSettings();
  return isLocale(s.defaultLocale) ? s.defaultLocale : DEFAULT_LOCALE;
}
