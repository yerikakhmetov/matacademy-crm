import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isTeacher } from "@/lib/teacher";
import { auth } from "@/auth";
import { canEdit } from "@/lib/roles";
import { money, initials, avatarColor, formatDate, STUDENT_STATUS, PAYMENT_STATUS, subStatus } from "@/lib/format";
import { ModalButton } from "@/components/ModalButton";
import { StudentForm } from "../StudentForm";
import { PaymentForm } from "../../payments/PaymentForm";
import { SubscriptionForm } from "./SubscriptionForm";
import { DeleteStudentButton } from "./DeleteStudentButton";
import { TelegramLink } from "./TelegramLink";
import { MarkPaidButton } from "@/components/MarkPaidButton";
import { createPayment, createSubscription, updateStudent } from "@/app/actions/data";
import { getSettings, parseTariffs } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function StudentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (isTeacher(session?.user?.role)) redirect("/dashboard");
  const editor = canEdit(session?.user?.role);

  const [student, groups] = await Promise.all([
    prisma.student.findUnique({
      where: { id },
      include: {
        group: { include: { teacher: true } },
        payments: { orderBy: { date: "desc" } },
        subscriptions: { orderBy: { startDate: "desc" } },
      },
    }),
    prisma.group.findMany({ orderBy: { name: "asc" } }),
  ]);
  const tariffs = parseTariffs((await getSettings()).tariffs);

  if (!student) notFound();

  const st = STUDENT_STATUS[student.status] ?? STUDENT_STATUS.ACTIVE;
  const activeSub = student.subscriptions[0];

  return (
    <>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/students" className="close-x" style={{ textDecoration: "none" }}>
            ←
          </Link>
          <div className="av2" style={{ background: avatarColor(student.name), width: 52, height: 52, fontSize: 18, borderRadius: 12 }}>
            {initials(student.name)}
          </div>
          <div>
            <h1 style={{ fontSize: 22 }}>{student.name}</h1>
            <p>
              {student.grade ?? "—"} · {student.group?.name ?? "Без группы"}
            </p>
          </div>
        </div>
        {editor && (
          <div style={{ display: "flex", gap: 10 }}>
            <ModalButton label="Редактировать" title="Редактировать ученика" icon="edit" buttonClass="btn ghost" action={updateStudent.bind(null, student.id)}>
              <StudentForm groups={groups} values={student} />
            </ModalButton>
            <ModalButton label="Оформить абонемент" title={`Абонемент · ${student.name}`} icon="check" buttonClass="btn ghost" action={createSubscription.bind(null, student.id)}>
              <SubscriptionForm tariffs={tariffs} />
            </ModalButton>
            <ModalButton label="Принять оплату" title={`Оплата · ${student.name}`} icon="money" action={createPayment}>
              <PaymentForm students={[student]} fixedStudentId={student.id} />
            </ModalButton>
          </div>
        )}
      </div>

      <div className="two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-h">
              <h3>История оплат</h3>
              <span className="chip c-mut">
                <span className="d" />
                {student.payments.length}
              </span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Назначение</th>
                    <th>Способ</th>
                    <th>Дата</th>
                    <th>Статус</th>
                    <th className="right">Сумма</th>
                    {editor && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {student.payments.length === 0 && (
                    <tr>
                      <td colSpan={editor ? 6 : 5}>
                        <div className="empty">Оплат пока нет</div>
                      </td>
                    </tr>
                  )}
                  {student.payments.map((p) => {
                    const ps = PAYMENT_STATUS[p.status] ?? PAYMENT_STATUS.PAID;
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.purpose}</td>
                        <td className="mut">{p.method ?? "—"}</td>
                        <td className="mut">{formatDate(p.date)}</td>
                        <td>
                          <span className={`chip ${ps.cls}`}>
                            <span className="d" />
                            {ps.label}
                          </span>
                        </td>
                        <td className="right money num">{money(p.amount)}</td>
                        {editor && (
                          <td className="right">
                            {p.status === "PAID" ? (
                              <Link className="btn ghost" href={`/receipt/${p.id}`} style={{ padding: "5px 11px", fontSize: 12.5 }}>
                                Квитанция
                              </Link>
                            ) : (
                              <MarkPaidButton paymentId={p.id} />
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-h">
              <h3>Профиль</h3>
              <span className={`chip ${st.cls}`}>
                <span className="d" />
                {st.label}
              </span>
            </div>
            <div style={{ padding: 18 }}>
              <dl className="dl">
                <dt>Телефон</dt>
                <dd>{student.phone ?? "—"}</dd>
                <dt>Родитель</dt>
                <dd>{student.parentName ?? "—"}</dd>
                <dt>Тел. родителя</dt>
                <dd>{student.parentPhone ?? "—"}</dd>
                <dt>Преподаватель</dt>
                <dd>{student.group?.teacher?.name ?? "—"}</dd>
                <dt>Посещаемость</dt>
                <dd style={{ color: student.attendance >= 85 ? "var(--ok)" : "var(--warn)" }}>{student.attendance}%</dd>
                <dt>Баланс</dt>
                <dd style={{ color: student.balance < 0 ? "var(--bad)" : "var(--ok)" }}>
                  {student.balance < 0 ? money(student.balance) : "Нет долга"}
                </dd>
              </dl>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h3>Абонементы</h3>
              {activeSub && (() => {
                const ss = subStatus(activeSub.endDate);
                return (
                  <span className={`chip ${ss.cls}`}>
                    <span className="d" />
                    {ss.label}
                  </span>
                );
              })()}
            </div>
            <div style={{ padding: "6px 0" }}>
              {student.subscriptions.length === 0 && <div className="empty">Абонементов пока нет</div>}
              {student.subscriptions.map((sub) => {
                const ss = subStatus(sub.endDate);
                return (
                  <div className="list-row" key={sub.id}>
                    <div className="pay-ico" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                      <span style={{ fontWeight: 800, fontSize: 13 }}>{sub.months}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{sub.plan}</div>
                      <div className="mut" style={{ fontSize: 12 }}>
                        {formatDate(sub.startDate)}{sub.endDate ? ` — ${formatDate(sub.endDate)}` : ""} · {money(sub.price)}
                      </div>
                    </div>
                    <span className={`chip ${ss.cls}`}>
                      <span className="d" />
                      {ss.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {editor && (
            <div className="card">
              <div className="card-h">
                <h3>Telegram-уведомления</h3>
                <span className={`chip ${student.telegramChatId ? "c-ok" : "c-mut"}`}>
                  <span className="d" />
                  {student.telegramChatId ? "Подключён" : "Не подключён"}
                </span>
              </div>
              <div style={{ padding: 18 }}>
                <TelegramLink
                  studentId={student.id}
                  linked={!!student.telegramChatId}
                  botUsername={process.env.TELEGRAM_BOT_USERNAME ?? null}
                />
              </div>
            </div>
          )}

          {editor && (
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ink-3)", fontWeight: 700, marginBottom: 12 }}>
                Опасная зона
              </div>
              <DeleteStudentButton id={student.id} name={student.name} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
