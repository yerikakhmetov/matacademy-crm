import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isTeacher } from "@/lib/teacher";
import { requireAccess } from "@/lib/access";
import { money, initials, avatarColor, formatDate } from "@/lib/format";
import { ReminderActions } from "@/components/ReminderActions";
import { BroadcastForm } from "./BroadcastForm";
import { markOverdue } from "@/lib/overdue";
import { cardCols } from "@/lib/card-table";
import { collectPackageAlerts, packageItemText } from "@/lib/reminders";

export const dynamic = "force-dynamic";

const SCHOOL = "МатАкадемии";

function daysAgo(d: Date) {
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export default async function RemindersPage() {
  const session = await auth();
  if (isTeacher(session?.user?.role)) redirect("/dashboard");
  await requireAccess("finance");

  await markOverdue();

  const [overdue, pending, groups, linkedCount] = await Promise.all([
    prisma.payment.findMany({ where: { status: "OVERDUE" }, include: { student: true }, orderBy: { date: "asc" } }),
    prisma.payment.findMany({ where: { status: "PENDING" }, include: { student: true }, orderBy: { date: "asc" } }),
    prisma.group.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.student.count({ where: { telegramChatId: { not: null } } }),
  ]);

  // Пакет занятий заканчивается: ученики, которым пора оплатить следующий месяц обучения
  const ending = await collectPackageAlerts();
  const msgEnding = (name: string, items: { subjectName: string; left: number; unpaid: number }[]) =>
    `Здравствуйте! Напоминаем из ${SCHOOL} (ученик: ${name}): заканчиваются оплаченные занятия (${items.map(packageItemText).join("; ")}). ` +
    `Чтобы занятия шли без перерыва, пожалуйста, оплатите следующий месяц обучения. Спасибо!`;

  const total = overdue.length + pending.length + ending.length;

  const msgOverdue = (name: string, purpose: string, amount: number, days: number) =>
    `Здравствуйте! Напоминаем об оплате обучения в ${SCHOOL} (ученик: ${name}): ${purpose} — ${money(amount)}. Просрочено на ${days} дн. Пожалуйста, оплатите при возможности. Спасибо!`;
  const msgPending = (name: string, purpose: string, amount: number) =>
    `Здравствуйте! Напоминаем об оплате в ${SCHOOL} (ученик: ${name}): ${purpose} — ${money(amount)}. Ждём оплату. Спасибо!`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Напоминания об оплате</h1>
          <p>{total > 0 ? `${total} напоминаний для отправки родителям` : "Всё оплачено — напоминаний нет"}</p>
        </div>
        <span className="proto-note">💬 Кнопка WhatsApp открывает чат с готовым текстом</span>
      </div>

      <BroadcastForm groups={groups} linkedCount={linkedCount} />

      {/* Просроченные */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <h3>Просроченные счета</h3>
          <span className="chip c-bad">
            <span className="d" />
            {overdue.length}
          </span>
        </div>
        <div className="table-wrap">
          <table {...cardCols(["Ученик", "Назначение", "Просрочка", "Сумма", ""])}>
            <thead>
              <tr>
                <th>Ученик</th>
                <th>Назначение</th>
                <th>Просрочка</th>
                <th className="right">Сумма</th>
                <th className="right">Напомнить</th>
              </tr>
            </thead>
            <tbody>
              {overdue.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty">Просроченных счетов нет 👍</div>
                  </td>
                </tr>
              )}
              {overdue.map((p) => {
                const days = Math.max(1, daysAgo(p.date));
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="person">
                        <div className="av2" style={{ background: avatarColor(p.student.name) }}>
                          {initials(p.student.name)}
                        </div>
                        <div>
                          <div className="nm">{p.student.name}</div>
                          <div className="sub">{p.student.parentName ?? "родитель не указан"}</div>
                        </div>
                      </div>
                    </td>
                    <td>{p.purpose}</td>
                    <td>
                      <span className="chip c-bad">
                        <span className="d" />
                        {days} дн.
                      </span>
                    </td>
                    <td className="right money num" style={{ color: "var(--bad)" }}>
                      {money(p.amount)}
                    </td>
                    <td>
                      <ReminderActions phone={p.student.parentPhone} message={msgOverdue(p.student.name, p.purpose, p.amount, days)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Пакет заканчивается */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <h3>Заканчиваются оплаченные занятия</h3>
          <span className="chip c-warn">
            <span className="d" />
            {ending.length}
          </span>
        </div>
        <div className="table-wrap">
          <table {...cardCols(["Ученик", "Занятия", ""])}>
            <thead>
              <tr>
                <th>Ученик</th>
                <th>Занятия</th>
                <th className="right">Напомнить</th>
              </tr>
            </thead>
            <tbody>
              {ending.length === 0 && (
                <tr>
                  <td colSpan={3}>
                    <div className="empty">У всех хватает оплаченных занятий</div>
                  </td>
                </tr>
              )}
              {ending.map((s) => (
                <tr key={s.studentId}>
                  <td>
                    <div className="person">
                      <div className="av2" style={{ background: avatarColor(s.name) }}>{initials(s.name)}</div>
                      <div>
                        <div className="nm">{s.name}</div>
                        <div className="sub">{s.parentName ?? "родитель не указан"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="td-text">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {s.items.map((it) => (
                        <span
                          key={it.subjectId}
                          className={`chip ${it.unpaid > 0 ? "c-bad" : "c-warn"}`}
                          title={it.notifiedAt ? `Напоминание в Telegram отправлено ${formatDate(it.notifiedAt)}` : undefined}
                        >
                          <span className="d" />
                          {packageItemText(it)}
                          {it.notifiedAt ? " · ✓ напомнили" : ""}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <ReminderActions phone={s.parentPhone} message={msgEnding(s.name, s.items)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ожидают оплаты */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <h3>Ожидают оплаты</h3>
          <span className="chip c-warn">
            <span className="d" />
            {pending.length}
          </span>
        </div>
        <div className="table-wrap">
          <table {...cardCols(["Ученик", "Назначение", "Срок", "Сумма", ""])}>
            <thead>
              <tr>
                <th>Ученик</th>
                <th>Назначение</th>
                <th>Срок</th>
                <th className="right">Сумма</th>
                <th className="right">Напомнить</th>
              </tr>
            </thead>
            <tbody>
              {pending.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty">Нет счетов в ожидании</div>
                  </td>
                </tr>
              )}
              {pending.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="person">
                      <div className="av2" style={{ background: avatarColor(p.student.name) }}>
                        {initials(p.student.name)}
                      </div>
                      <div>
                        <div className="nm">{p.student.name}</div>
                        <div className="sub">{p.student.parentName ?? "родитель не указан"}</div>
                      </div>
                    </div>
                  </td>
                  <td>{p.purpose}</td>
                  <td className="mut">до {formatDate(p.date)}</td>
                  <td className="right money num">{money(p.amount)}</td>
                  <td>
                    <ReminderActions phone={p.student.parentPhone} message={msgPending(p.student.name, p.purpose, p.amount)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </>
  );
}
