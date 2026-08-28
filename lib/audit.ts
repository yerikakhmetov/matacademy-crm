import { prisma } from "./prisma";
import { auth } from "@/auth";

// Записать событие в журнал изменений. Никогда не роняет основное действие.
export async function logAudit(action: "CREATE" | "UPDATE" | "DELETE", entity: string, label: string) {
  try {
    const session = await auth();
    await prisma.auditLog.create({
      data: {
        userId: session?.user?.id ?? null,
        userName: session?.user?.name ?? "Система",
        action,
        entity,
        label,
      },
    });
  } catch {
    // логирование не должно ломать операцию
  }
}
