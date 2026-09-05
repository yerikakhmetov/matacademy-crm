// Локализация страниц, которые видят ученики и родители.
// Без библиотек: словарь + t(). Ключи типизированы — забыть перевод нельзя,
// TypeScript потребует все ключи в каждом языке.

export const LOCALES = ["ru", "kk"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ru";

export const LOCALE_LABEL: Record<Locale, string> = {
  ru: "Русский",
  kk: "Қазақша",
};

export function isLocale(v: string | null | undefined): v is Locale {
  return v === "ru" || v === "kk";
}

const ru = {
  // общее
  "common.refresh": "Обновить",
  "common.logout": "Выйти",
  "common.noGroup": "без группы",
  "common.today": "сегодня",
  "common.language": "Язык",

  // страница-приглашение
  "join.cabinetOf": "Личный кабинет ученика: {name}",
  "join.onlyTelegram": "Вход только через Telegram. Ссылка персональная — не передавайте её другим.",
  "join.invalidLink": "Ссылка недействительна. Попросите у школы новую ссылку-приглашение.",
  "join.botNotConfigured": "Telegram-бот не настроен. Обратитесь к школе.",
  "join.loginTelegram": "Войти через Telegram",
  "join.confirming": "Подтвердите в Telegram…",
  "join.timeout": "Время ожидания истекло. Нажмите ещё раз.",
  "join.openBotHint": "Откройте бота и нажмите «Старт» — кабинет откроется автоматически.",

  // кабинет
  "lms.studentCabinet": "Личный кабинет ученика",
  "cabinet.profileNotFound": "Профиль ученика не найден. Обратитесь в школу.",
  "cabinet.morning": "Доброе утро",
  "cabinet.day": "Добрый день",
  "cabinet.evening": "Добрый вечер",
  "cabinet.attendance": "Посещаемость",
  "cabinet.avgScore": "Средний балл",
  "cabinet.schedule": "Расписание",
  "cabinet.noSchedule": "Расписание не задано",
  "cabinet.tests": "Тесты",
  "cabinet.questionsShort": "вопр.",
  "cabinet.correctShort": "верно",
  "cabinet.take": "Пройти →",
  "cabinet.afterLesson": "После урока {date}",
  "cabinet.coveredTopics": "Пройденные темы",
  "cabinet.materials": "Материалы",
  "cabinet.howAreThings": "Как идут дела",
  "cabinet.lastN": "последние {n}",
  "cabinet.progressNote": "Результаты по оценкам в процентах — от старых к новым.",
  "cabinet.grades": "Оценки",
  "cabinet.noGrades": "Оценок пока нет",
  "cabinet.attendanceByLesson": "Посещаемость по занятиям",
  "cabinet.present": "Был",
  "cabinet.excused": "Уважительная",
  "cabinet.missed": "Пропуск",
  "cabinet.excusedNote": "Пропуски по уважительной причине не влияют на процент посещаемости.",

  // домашние задания
  "hw.title": "Домашние задания",
  "hw.empty": "Заданий пока нет",
  "hw.done": "Выполнено",
  "hw.overdue": "Просрочено",
  "hw.active": "Активно",
  "hw.markDone": "Отметить выполненным",
  "hw.markUndone": "Отметить невыполненным",
  "hw.due": "срок: {date}",

  // тест
  "test.summary": "{n} вопросов · макс. {max} баллов",
  "test.yourResult": "Ваш результат",
  "test.ofCorrect": "{correct} из {total} верно",
  "test.retakeNote": "Этот тест можно пройти заново — прошлый результат заменится новым.",
  "test.retake": "Пройти заново",
  "test.correct": "Верно",
  "test.wrong": "Ошибка",
  "test.yourAnswer": "ваш ответ",
  "test.notOpenTitle": "Тест ещё не открыт",
  "test.notOpenNote": "Он станет доступен после урока по расписанию ({date}).",
  "test.retakeHint": "Тест можно пройти заново — последний результат станет итоговым.",
  "test.onceHint": "Тест можно пройти один раз. Проверьте ответы перед отправкой.",
  "test.submit": "Отправить",

  // портал родителя
  "portal.diary": "Дневник ученика",
  "portal.balance": "Баланс",
  "portal.noDebt": "Нет долга",
  "portal.subscription": "Абонемент",
  "portal.plan": "Тариф",
  "portal.validFor": "Действует",
  "portal.price": "Стоимость",
  "portal.noSubscription": "Активного абонемента нет",
  "portal.hwNotDone": "Не выполнено",
  "portal.forWhat": "За что",
  "portal.type": "Тип",
  "portal.date": "Дата",
  "portal.grade": "Оценка",
  "portal.payments": "История оплат",
  "portal.purpose": "Назначение",
  "portal.status": "Статус",
  "portal.sum": "Сумма",
  "portal.noPayments": "Оплат пока нет",
  "portal.autoUpdate": "страница обновляется автоматически",
} as const;

export type MsgKey = keyof typeof ru;

const kk: Record<MsgKey, string> = {
  "common.refresh": "Жаңарту",
  "common.logout": "Шығу",
  "common.noGroup": "топсыз",
  "common.today": "бүгін",
  "common.language": "Тіл",

  "join.cabinetOf": "Оқушының жеке кабинеті: {name}",
  "join.onlyTelegram": "Кіру тек Telegram арқылы. Сілтеме жеке — оны басқаға бермеңіз.",
  "join.invalidLink": "Сілтеме жарамсыз. Мектептен жаңа шақыру сілтемесін сұраңыз.",
  "join.botNotConfigured": "Telegram-бот бапталмаған. Мектепке хабарласыңыз.",
  "join.loginTelegram": "Telegram арқылы кіру",
  "join.confirming": "Telegram-да растаңыз…",
  "join.timeout": "Күту уақыты бітті. Қайта басыңыз.",
  "join.openBotHint": "Ботты ашып, «Старт» батырмасын басыңыз — кабинет өзі ашылады.",

  "lms.studentCabinet": "Оқушының жеке кабинеті",
  "cabinet.profileNotFound": "Оқушы профилі табылмады. Мектепке хабарласыңыз.",
  "cabinet.morning": "Қайырлы таң",
  "cabinet.day": "Қайырлы күн",
  "cabinet.evening": "Қайырлы кеш",
  "cabinet.attendance": "Сабаққа қатысу",
  "cabinet.avgScore": "Орташа балл",
  "cabinet.schedule": "Сабақ кестесі",
  "cabinet.noSchedule": "Кесте әлі жасалмаған",
  "cabinet.tests": "Тесттер",
  "cabinet.questionsShort": "сұрақ",
  "cabinet.correctShort": "дұрыс",
  "cabinet.take": "Тапсыру →",
  "cabinet.afterLesson": "{date} сабағынан кейін",
  "cabinet.coveredTopics": "Өткен тақырыптар",
  "cabinet.materials": "Материалдар",
  "cabinet.howAreThings": "Үлгерім динамикасы",
  "cabinet.lastN": "соңғы {n}",
  "cabinet.progressNote": "Бағалар пайызбен — ескісінен жаңасына қарай.",
  "cabinet.grades": "Бағалар",
  "cabinet.noGrades": "Баға әлі қойылмаған",
  "cabinet.attendanceByLesson": "Сабақтар бойынша қатысу",
  "cabinet.present": "Келді",
  "cabinet.excused": "Себепті",
  "cabinet.missed": "Себепсіз",
  "cabinet.excusedNote": "Себепті қалған сабақ қатысу пайызына әсер етпейді.",

  "hw.title": "Үй тапсырмасы",
  "hw.empty": "Тапсырма әзірге жоқ",
  "hw.done": "Орындалды",
  "hw.overdue": "Мерзімі өтті",
  "hw.active": "Белсенді",
  "hw.markDone": "Орындалды деп белгілеу",
  "hw.markUndone": "Орындалмады деп белгілеу",
  "hw.due": "мерзімі: {date}",

  "test.summary": "{n} сұрақ · ең жоғары {max} балл",
  "test.yourResult": "Сіздің нәтижеңіз",
  "test.ofCorrect": "{total} сұрақтың {correct} дұрыс",
  "test.retakeNote": "Бұл тестті қайта тапсыруға болады — алдыңғы нәтиже жаңасымен ауысады.",
  "test.retake": "Қайта тапсыру",
  "test.correct": "Дұрыс",
  "test.wrong": "Қате",
  "test.yourAnswer": "сіздің жауабыңыз",
  "test.notOpenTitle": "Тест әлі ашылмаған",
  "test.notOpenNote": "Ол кесте бойынша сабақ өткеннен кейін ашылады ({date}).",
  "test.retakeHint": "Тестті қайта тапсыруға болады — соңғы нәтиже қорытынды болады.",
  "test.onceHint": "Тест бір рет қана тапсырылады. Жібермес бұрын жауаптарыңызды тексеріңіз.",
  "test.submit": "Жіберу",

  "portal.diary": "Оқушының күнделігі",
  "portal.balance": "Баланс",
  "portal.noDebt": "Қарыз жоқ",
  "portal.subscription": "Абонемент",
  "portal.plan": "Тариф",
  "portal.validFor": "Жарамды",
  "portal.price": "Құны",
  "portal.noSubscription": "Белсенді абонемент жоқ",
  "portal.hwNotDone": "Орындалмаған",
  "portal.forWhat": "Не үшін",
  "portal.type": "Түрі",
  "portal.date": "Күні",
  "portal.grade": "Баға",
  "portal.payments": "Төлемдер тарихы",
  "portal.purpose": "Мақсаты",
  "portal.status": "Күйі",
  "portal.sum": "Сомасы",
  "portal.noPayments": "Төлем әзірге жоқ",
  "portal.autoUpdate": "бет автоматты жаңарып отырады",
};

const DICT: Record<Locale, Record<MsgKey, string>> = { ru, kk };

export function t(locale: Locale, key: MsgKey, vars?: Record<string, string | number>): string {
  const s = DICT[locale][key] ?? DICT[DEFAULT_LOCALE][key] ?? key;
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}
