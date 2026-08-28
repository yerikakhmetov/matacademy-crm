import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { initials, avatarColor } from "@/lib/format";

export const dynamic = "force-dynamic";

const ACTION: Record<string, { cls: string; label: string }> = {
  CREATE: { cls: "c-ok", label: "Создано" },
  UPDATE: { cls: "c-acc", label: "Изменено" },
  DELETE: { cls: "c-bad", label: "Удалено" },
};

function when(d: Date) {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function AuditPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>История изменений</h1>
          <p>Кто и что менял в системе · последние {logs.length} событий</p>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Кто</th>
                <th>Действие</th>
                <th>Объект</th>
                <th>Что именно</th>
                <th className="right">Когда</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty">Пока нет записей — история начнёт заполняться при изменениях</div>
                  </td>
                </tr>
              )}
              {logs.map((l) => {
                const a = ACTION[l.action] ?? ACTION.UPDATE;
                return (
                  <tr key={l.id}>
                    <td>
                      <div className="person">
                        <div className="av2" style={{ background: avatarColor(l.userName), width: 30, height: 30, fontSize: 11 }}>
                          {initials(l.userName)}
                        </div>
                        <div className="nm" style={{ fontSize: 13 }}>
                          {l.userName}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`chip ${a.cls}`}>
                        <span className="d" />
                        {a.label}
                      </span>
                    </td>
                    <td className="mut">{l.entity}</td>
                    <td style={{ fontWeight: 600 }}>{l.label}</td>
                    <td className="right mut">{when(l.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
