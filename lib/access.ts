import { auth } from "@/auth";
import { getSettings } from "@/lib/settings";
import { redirect } from "next/navigation";

// Права менеджера, которые администратор может включать/выключать.
// Хранятся в Settings.managerDenied как список ЗАПРЕЩЁННЫХ ключей (пусто = полный доступ).
export const MANAGER_PERMS = [
  { key: "edit", label: "Создание и редактирование данных", desc: "Добавлять, изменять и удалять учеников, группы, оплаты и т.д. Без права — только просмотр." },
  { key: "finance", label: "Оплаты и напоминания", desc: "Доступ к разделам «Оплаты» и «Напоминания», суммы и долги." },
  { key: "payroll", label: "Зарплата преподавателей", desc: "Раздел «Зарплата» и расчёт ставок." },
  { key: "leads", label: "Лиды и продажи", desc: "Воронка продаж и работа с заявками." },
  { key: "reports", label: "Отчёты и аналитика", desc: "Раздел «Отчёты»." },
  { key: "teachers", label: "Управление преподавателями", desc: "Раздел «Учителя»." },
] as const;

export type PermKey = (typeof MANAGER_PERMS)[number]["key"];

export function parseDenied(s?: string | null): Set<string> {
  return new Set((s ?? "").split(",").map((x) => x.trim()).filter(Boolean));
}

// Разрешение с учётом роли. Запреты действуют только на менеджера.
export function allow(role: string | undefined | null, key: PermKey, denied: Set<string>): boolean {
  if (role === "ADMIN") return true;
  if (role === "MANAGER") return !denied.has(key);
  return false; // преподаватель и прочие — нет доступа к этим модулям
}

// Единая точка: сессия + настройки + проверка прав (для server components / actions).
export async function getAccess() {
  const [session, settings] = await Promise.all([auth(), getSettings()]);
  const role = session?.user?.role;
  const denied = parseDenied(settings.managerDenied);
  return {
    session,
    role,
    denied,
    can: (key: PermKey) => allow(role, key, denied),
  };
}

// Может ли текущий пользователь редактировать данные (роль + право менеджера «edit»).
export async function canEditData(role?: string | null): Promise<boolean> {
  if (role === "ADMIN") return true;
  if (role !== "MANAGER") return false;
  const settings = await getSettings();
  return !parseDenied(settings.managerDenied).has("edit");
}

// Guard для страниц: если модуль недоступен — на дашборд.
export async function requireAccess(key: PermKey) {
  const { can } = await getAccess();
  if (!can(key)) redirect("/dashboard");
}
