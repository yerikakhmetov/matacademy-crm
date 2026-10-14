import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isTeacher } from "@/lib/teacher";
import { isCurator } from "@/lib/curator";
import { auth } from "@/auth";
import { canEditData, getAccess } from "@/lib/access";
import { money, initials, avatarColor, formatDate, STUDENT_STATUS, PAYMENT_STATUS, gradeChipClass } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { PhotoUpload } from "@/components/PhotoUpload";
import { ModalButton } from "@/components/ModalButton";
import { StudentForm } from "../StudentForm";
import { PaymentForm } from "../../payments/PaymentForm";
import { InvoiceForm } from "./InvoiceForm";
import { DeleteStudentButton } from "./DeleteStudentButton";
import { TelegramLink } from "./TelegramLink";
import { ParentPortalLink } from "./ParentPortalLink";
import { StudentCabinetLink } from "./StudentCabinetLink";
import { PaymentActions } from "@/components/PaymentActions";
import { PaymentEditForm } from "../../payments/PaymentEditForm";
import { canFixReceived } from "@/lib/payments";
import { createInvoice, createPayment, updatePayment } from "@/app/actions/payments";
import { updateStudent } from "@/app/actions/students";
import { getSettings, parseDiscounts, parseMultiTiers, isDiscountMode } from "@/lib/settings";
import { schoolClock } from "@/lib/school-time";
import { periodLabel } from "@/lib/period";
import { cardCols } from "@/lib/card-table";

export const dynamic = "force-dynamic";

export default async function StudentDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const session = await auth();
  if (isTeacher(session?.user?.role)) redirect("/dashboard");
  // Куратор открывает только учеников своих групп
  if (isCurator(session?.user?.role)) {
    const mine = await prisma.student.count({ where: { id, groups: { some: { curatorId: session?.user?.id ?? "__none__" } } } });
    if (mine === 0) notFound();
  }
  const editor = await canEditData(session?.user?.role);
  const showMoney = (await getAccess()).can("finance"); // finance-модуль запрещён менеджеру → скрываем деньги

  const [student, groups] = await Promise.all([
    prisma.student.findUnique({
      where: { id },
      include: {
        groups: { include: { teacher: true } },
        payments: {
          orderBy: { date: "desc" },
          // для правки: движения денег и предметы счёта
          include: {
            txs: { select: { id: true, kind: true, amount: true } },
            items: { select: { subjectId: true } },
          },
        },
      },
    }),
    prisma.group.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!student) notFound();

  // Вкладки карточки: оплаты (если есть доступ к деньгам), посещаемость, оценки
  const tabs = [...(showMoney ? (["payments"] as const) : []), "attendance", "grades"] as const;
  const tab = (tabs as readonly string[]).includes(tabParam ?? "") ? (tabParam as string) : tabs[0];
  const TAB_LABEL: Record<string, string> = { payments: "Оплаты", attendance: "Посещаемость", grades: "Оценки" };

  const [settings, activeSubjects, allStudents, attendance, grades] = await Promise.all([
    getSettings(),
    prisma.subject.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, price: true, lessonsPerMonth: true, color: true } }),
    // список учеников нужен, только чтобы перенести ошибочную оплату на правильного
    editor && showMoney ? prisma.student.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
    tab === "attendance"
      ? prisma.attendance.findMany({
          where: { studentId: id },
          orderBy: { date: "desc" },
          take: 40,
          include: { lesson: { select: { startTime: true, group: { select: { name: true, color: true } } } } },
        })
      : Promise.resolve([]),
    tab === "grades"
      ? prisma.grade.findMany({
          where: { studentId: id },
          orderBy: { date: "desc" },
          take: 30,
          include: { group: { select: { name: true, subject: { select: { name: true } } } } },
        })
      : Promise.resolve([]),
  ]);
  const todayIso = schoolClock(settings.tzOffsetHours).toISOString().slice(0, 10);
  const discounts = parseDiscounts(settings.discounts);
  const tiers = parseMultiTiers(settings.multiDiscount);
  const mode = isDiscountMode(settings.discountMode) ? settings.discountMode : "add";
  const personalPct = Math.max(0, student.personalDiscount);
  let siblingPct = 0;
  if (settings.siblingDiscount > 0 && student.parentPhone) {
    const sib = await prisma.student.count({ where: { id: { not: student.id }, status: "ACTIVE", parentPhone: student.parentPhone } });
    if (sib > 0) siblingPct = settings.siblingDiscount;
  }
  const promos = editor ? await prisma.promoCode.findMany({ where: { active: true }, select: { code: true, percent: true }, orderBy: { code: "asc" } }) : [];

  // Ленивая генерация постоянного токена родительской страницы
  let portalToken = student.portalToken;
  if (!portalToken && editor) {
    portalToken = crypto.randomUUID().replace(/-/g, "");
    await prisma.student.update({ where: { id }, data: { portalToken } });
  }

  // Ленивая генерация токена ссылки-приглашения в кабинет
  let joinToken = student.joinToken;
  if (!joinToken && editor) {
    joinToken = crypto.randomUUID().replace(/-/g, "");
    await prisma.student.update({ where: { id }, data: { joinToken } });
  }

  const st = STUDENT_STATUS[student.status] ?? STUDENT_STATUS.ACTIVE;

  return (
    <>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/students" className="close-x" style={{ textDecoration: "none" }}>
            ←
          </Link>
          <Avatar name={student.name} photoUrl={student.photoUrl} size={52} radius={12} />
          <div>
            <h1 style={{ fontSize: 22 }}>{student.name}</h1>
            <p>
              {student.grade ?? "—"} · {student.groups.length ? student.groups.map((g) => g.name).join(", ") : "Без группы"}
            </p>
          </div>
        </div>
        {editor && (
          <div style={{ display: "flex", gap: 10 }}>
            <ModalButton label="Редактировать" title="Редактировать ученика" icon="edit" buttonClass="btn ghost" action={updateStudent.bind(null, student.id)}>
              <StudentForm groups={groups} values={{ ...student, groupIds: student.groups.map((g) => g.id) }} />
            </ModalButton>
            {showMoney && (
              <>
                <ModalButton label="Выставить счёт" title={`Счёт · ${student.name}`} icon="check" buttonClass="btn ghost" action={createInvoice.bind(null, student.id)}>
                  <InvoiceForm subjects={activeSubjects} discounts={discounts} tiers={tiers} mode={mode} personalPct={personalPct} siblingPct={siblingPct} promos={promos} todayIso={todayIso} />
                </ModalButton>
                <ModalButton label="Принять оплату" title={`Оплата · ${student.name}`} icon="money" action={createPayment}>
                  <PaymentForm students={[student]} fixedStudentId={student.id} subjects={activeSubjects} todayIso={todayIso} />
                </ModalButton>
              </>
            )}
          </div>
        )}
      </div>

      <div className="two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <nav className="seg" aria-label="Разделы карточки" style={{ alignSelf: "flex-start" }}>
            {tabs.map((k) => (
              <Link key={k} href={`/students/${student.id}?tab=${k}`} className={k === tab ? "on" : ""} aria-current={k === tab ? "page" : undefined}>
                {TAB_LABEL[k]}
              </Link>
            ))}
          </nav>

          {tab === "payments" && showMoney && (
          <div className="card">
            <div className="card-h">
              <h3>История оплат</h3>
              <span className="chip c-mut">
                <span className="d" />
                {student.payments.length}
              </span>
            </div>
            <div className="table-wrap">
              <table {...cardCols(["Назначение", "Способ", "Период", "Статус", "Сумма", editor && ""])}>
                <thead>
                  <tr>
                    <th>Назначение</th>
                    <th>Способ</th>
                    <th>Период</th>
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
                        <td className="td-text" style={{ fontWeight: 600 }}>{p.purpose}</td>
                        <td className="mut">{p.method ?? "—"}</td>
                        <td className="mut">{periodLabel(p.date, p.months)}</td>
                        <td>
                          <span className={`chip ${ps.cls}`}>
                            <span className="d" />
                            {ps.label}
                          </span>
                        </td>
                        <td className="right money num">
                          {money(p.amount)}
                          {p.paidAmount > 0 && p.paidAmount < p.amount && (
                            <div className="mut" style={{ fontSize: 11.5, fontWeight: 500 }}>остаток {money(p.amount - p.paidAmount)}</div>
                          )}
                          {p.refundedAmount > 0 && (
                            <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--bad)" }}>возврат {money(p.refundedAmount)}</div>
                          )}
                        </td>
                        {editor && (
                          <td className="right">
                            <PaymentActions
                            paymentId={p.id}
                            amount={p.amount}
                            paidAmount={p.paidAmount}
                            refundedAmount={p.refundedAmount}
                            edit={
                              <ModalButton
                                label="Изменить"
                                title={`Исправить оплату · ${student.name}`}
                                icon="edit"
                                buttonClass="btn ghost"
                                action={updatePayment.bind(null, p.id)}
                              >
                                <PaymentEditForm
                                  students={allStudents}
                                  subjects={activeSubjects}
                                  canFixReceived={canFixReceived(p)}
                                  todayIso={todayIso}
                                  value={{
                                    studentId: student.id,
                                    purpose: p.purpose,
                                    amount: p.amount,
                                    paidAmount: p.paidAmount,
                                    method: p.method,
                                    date: p.date,
                                    months: p.months,
                                    subjectIds: p.items.map((i) => i.subjectId).filter((x): x is string => !!x),
                                  }}
                                />
                              </ModalButton>
                            }
                          />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {tab === "attendance" && (
            <div className="card">
              <div className="card-h">
                <h3>Посещаемость</h3>
                <span className="chip c-mut"><span className="d" />последние {attendance.length}</span>
              </div>
              <div style={{ padding: "6px 0" }}>
                {attendance.length === 0 && <div className="empty">Отметок пока нет</div>}
                {attendance.map((a) => {
                  const st = a.present ? { cls: "c-ok", label: "Был" } : a.excused ? { cls: "c-mut", label: "Ув. причина" } : { cls: "c-bad", label: "Без причины" };
                  return (
                    <div className="list-row" key={a.id}>
                      <div className="num mut" style={{ width: 70, fontSize: 12.5, fontWeight: 600 }}>{formatDate(a.date)}</div>
                      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: a.lesson.group.color, flex: "none" }} />
                        <span style={{ fontWeight: 600 }}>{a.lesson.group.name}</span>
                        <span className="mut" style={{ fontSize: 12 }}>{a.lesson.startTime}</span>
                      </div>
                      <span className={`chip ${st.cls}`}><span className="d" />{st.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "grades" && (
            <div className="card">
              <div className="card-h">
                <h3>Оценки</h3>
                <span className="chip c-mut"><span className="d" />{grades.length}</span>
              </div>
              <div style={{ padding: "6px 0" }}>
                {grades.length === 0 && <div className="empty">Оценок пока нет</div>}
                {grades.map((g) => {
                  const pct = Math.round((g.score / g.maxScore) * 100);
                  return (
                    <div className="list-row" key={g.id}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{g.topic}</div>
                        <div className="mut" style={{ fontSize: 12 }}>
                          {[g.group?.subject?.name ?? g.group?.name, formatDate(g.date)].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <span className={`chip ${gradeChipClass(pct)}`}><span className="d" />{g.score}/{g.maxScore}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
                <dd>{[...new Set(student.groups.map((g) => g.teacher?.name).filter(Boolean))].join(", ") || "—"}</dd>
                <dt>Посещаемость</dt>
                <dd style={{ color: student.attendance == null ? "var(--ink-3)" : student.attendance >= 85 ? "var(--ok)" : "var(--warn)" }}>{student.attendance == null ? "—" : `${student.attendance}%`}</dd>
                {showMoney && (
                  <>
                    <dt>Баланс</dt>
                    <dd style={{ color: student.balance < 0 ? "var(--bad)" : "var(--ok)" }}>
                      {student.balance < 0 ? money(student.balance) : "Нет долга"}
                    </dd>
                  </>
                )}
              </dl>
            </div>
          </div>

          {editor && (
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ink-3)", fontWeight: 700, marginBottom: 12 }}>
                Фото ученика
              </div>
              <PhotoUpload entity="student" id={student.id} name={student.name} photoUrl={student.photoUrl} size={64} />
            </div>
          )}

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

          {editor && portalToken && (
            <div className="card">
              <div className="card-h">
                <h3>Страница для родителя</h3>
                <span className="chip c-acc">
                  <span className="d" />
                  постоянная ссылка
                </span>
              </div>
              <div style={{ padding: 18 }}>
                <ParentPortalLink studentId={student.id} token={portalToken} />
              </div>
            </div>
          )}

          {editor && (
            <div className="card">
              <div className="card-h">
                <h3>Кабинет ученика</h3>
                <span className={`chip ${student.userId ? "c-ok" : "c-mut"}`}>
                  <span className="d" />
                  {student.userId ? "привязан" : "не привязан"}
                </span>
              </div>
              <div style={{ padding: 18 }}>
                <StudentCabinetLink studentId={student.id} token={joinToken!} linked={!!student.userId} claimed={!!student.joinTgId} />
              </div>
            </div>
          )}

          {editor && (
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ink-3)", fontWeight: 700, marginBottom: 12 }}>
                Архив и удаление
              </div>
              <DeleteStudentButton
                id={student.id}
                name={student.name}
                isAdmin={session?.user?.role === "ADMIN"}
                archived={student.status === "LEFT"}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
