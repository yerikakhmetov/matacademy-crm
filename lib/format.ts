const PAL = ["#3A5AE0", "#7048E8", "#0C8599", "#2F9E44", "#E8590C", "#C2255C", "#1098AD", "#5C7CFA"];

export function money(n: number): string {
  const sign = n < 0 ? "−" : "";
  return sign + Math.abs(n).toLocaleString("ru-RU").replace(/ /g, " ") + " ₸";
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function avatarColor(seed: string): string {
  const sum = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0);
  return PAL[sum % PAL.length];
}

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// Статусы учеников
export const STUDENT_STATUS: Record<string, { cls: string; label: string }> = {
  ACTIVE: { cls: "c-ok", label: "Активен" },
  PAUSED: { cls: "c-warn", label: "На паузе" },
  LEFT: { cls: "c-mut", label: "Ушёл" },
};

// Статусы оплат
export const PAYMENT_STATUS: Record<string, { cls: string; label: string }> = {
  PAID: { cls: "c-ok", label: "Оплачено" },
  PENDING: { cls: "c-warn", label: "Ожидает" },
  OVERDUE: { cls: "c-bad", label: "Просрочен" },
};

// Этапы воронки
export const LEAD_STAGES: { key: string; label: string; color: string }[] = [
  { key: "NEW", label: "Новая заявка", color: "#8A93A6" },
  { key: "CONTACTED", label: "Дозвонились", color: "#3A5AE0" },
  { key: "TRIAL", label: "Пробный урок", color: "#7048E8" },
  { key: "INVOICED", label: "Ждём оплату", color: "#F08C00" },
  { key: "WON", label: "Оплатили", color: "#2F9E44" },
  { key: "LOST", label: "Отказ", color: "#E03131" },
];

export const DAYS = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

// Статус абонемента по дате окончания
export function subStatus(endDate: Date | string | null): { cls: string; label: string; daysLeft: number | null } {
  if (!endDate) return { cls: "c-mut", label: "Бессрочный", daysLeft: null };
  const end = typeof endDate === "string" ? new Date(endDate) : endDate;
  const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
  if (days < 0) return { cls: "c-bad", label: "Истёк", daysLeft: days };
  if (days <= 14) return { cls: "c-warn", label: `Истекает через ${days} дн.`, daysLeft: days };
  return { cls: "c-ok", label: "Активен", daysLeft: days };
}

// Типы активностей лида
export const ACTIVITY_TYPE: Record<string, { label: string; icon: string; cls: string }> = {
  CALL: { label: "Звонок", icon: "phone", cls: "c-acc" },
  TASK: { label: "Задача", icon: "check", cls: "c-vio" },
  NOTE: { label: "Заметка", icon: "edit", cls: "c-mut" },
};

export const LEAD_SOURCES = ["Instagram", "2ГИС", "Сайт", "Реклама", "Рекомендация", "Другое"];

// Типы оценок
export const GRADE_TYPE: Record<string, string> = {
  TEST: "Контрольная",
  HOMEWORK: "Домашняя",
  QUIZ: "Самостоятельная",
  EXAM: "Экзамен",
};

// Цвет по проценту (для оценок и посещаемости)
export function scoreColor(pct: number): string {
  if (pct >= 85) return "var(--ok)";
  if (pct >= 70) return "var(--warn)";
  if (pct >= 50) return "var(--amber)";
  return "var(--bad)";
}

export function gradeChipClass(pct: number): string {
  if (pct >= 85) return "c-ok";
  if (pct >= 70) return "c-warn";
  return "c-bad";
}

// Типы ставки преподавателя

// Категории расходов школы
export const EXPENSE_CATEGORY: Record<string, string> = {
  RENT: "Аренда",
  UTILITIES: "Коммунальные",
  ADS: "Реклама",
  EQUIPMENT: "Оборудование",
  TAX: "Налоги и сборы",
  OTHER: "Прочее",
};
