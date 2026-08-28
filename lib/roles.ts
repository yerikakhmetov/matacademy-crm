// Роли и права доступа
export type Role = "ADMIN" | "MANAGER" | "TEACHER";

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Администратор",
  MANAGER: "Менеджер",
  TEACHER: "Преподаватель",
};

// Кто может создавать/редактировать/удалять данные
export function canEdit(role?: string | null): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

// Кто видит финансовые модули (оплаты) целиком
export function canSeeMoney(role?: string | null): boolean {
  return role === "ADMIN" || role === "MANAGER";
}
