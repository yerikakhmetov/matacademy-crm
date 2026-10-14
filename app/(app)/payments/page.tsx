import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { netRevenue } from "@/lib/revenue";
import { getSettings } from "@/lib/settings";
import { schoolClock, schoolMonthStart } from "@/lib/school-time";
import { invoicePeriodLabel } from "@/lib/period";
import { auth } from "@/auth";
import { canEditData, requireAccess } from "@/lib/access";
import { isTeacher } from "@/lib/teacher";
import { money, initials, avatarColor, formatDate, PAYMENT_STATUS } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { ModalButton } from "@/components/ModalButton";
import { PaymentForm } from "./PaymentForm";
import { PaymentActions } from "@/components/PaymentActions";
import { createPayment, updatePayment } from "@/app/actions/payments";
import { markOverdue } from "@/lib/overdue";
import { PaymentEditForm } from "./PaymentEditForm";
import { canFixReceived } from "@/lib/payments";
import { cardCols } from "@/lib/card-table";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "Все" },
  { key: "PAID", label: "Оплачено" },
  { key: "PENDING", label: "Ожидают" },
  { key: "OVERDUE", label: "Долги" },
];


// Счётов за годы набирается тысячи — показываем страницами
const PAGE_SIZE = 50;

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const { status = "all", page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const session = await auth();
  if (isTeacher(session?.user?.role)) redirect("/dashboard");
  await requireAccess("finance");
  const editor = await canEditData(session?.user?.role);

  await markOverdue(); // автопометка просроченных счетов

  const where = status === "all" ? {} : { status };

  // доход «за месяц» — месяц школы: оплата 1-го числа в 02:00 не уходит в прошлый
  const tz = (await getSettings()).tzOffsetHours;
  const clock = schoolClock(tz);
  const monthFrom = schoolMonthStart(clock.getUTCFullYear(), clock.getUTCMonth(), tz);

  const [payments, total, students, subjects, revenue, owing, paidCount] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        // только то, что нужно таблице: токены и телефоны ученика сюда не тянем
        student: { select: { name: true } },
        // для правки: движения денег (можно ли исправить принятую сумму) и предметы
        txs: { select: { id: true, kind: true, amount: true } },
        items: { select: { subjectId: true } },
      },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    }),
    prisma.payment.count({ where }),
    prisma.student.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.subject.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
    netRevenue(monthFrom),
    // Долги считаем по остаткам, а не по полной сумме счёта: частично оплаченный
    // счёт должен попадать в «ожидается» только неоплаченной частью.
    prisma.payment.findMany({
      where: { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
      select: { amount: true, paidAmount: true, status: true, studentId: true },
    }),
    prisma.paymentTx.count({ where: { kind: "PAYMENT", date: { gte: monthFrom } } }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (n: number) => `/payments?status=${status}${n > 1 ? `&page=${n}` : ""}`;
  const avg = paidCount > 0 ? Math.round(revenue / paidCount) : 0;
  const left = (p: { amount: number; paidAmount: number }) => Math.max(0, p.amount - p.paidAmount);
  const pendingSum = owing.filter((p) => p.status !== "OVERDUE").reduce((a, p) => a + left(p), 0);
  const pendingCount = owing.filter((p) => p.status !== "OVERDUE").length;
  const overdueSum = owing.filter((p) => p.status === "OVERDUE").reduce((a, p) => a + left(p), 0);
  const overdueStudents = new Set(owing.filter((p) => p.status === "OVERDUE").map((p) => p.studentId)).size;

  const kpis = [
    { l: "Поступило за месяц", v: money(revenue), icon: "check", col: "var(--ok)", bg: "var(--ok-soft)" },
    { l: "Ожидается", v: money(pendingSum), t: `${pendingCount} счетов`, icon: "clock", col: "var(--warn)", bg: "var(--warn-soft)" },
    { l: "Просрочено", v: money(overdueSum), t: `${overdueStudents} учеников`, icon: "alert", col: "var(--bad)", bg: "var(--bad-soft)" },
    { l: "Средний чек", v: money(avg), icon: "chart", col: "var(--accent)", bg: "var(--accent-soft)" },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Оплаты и счета</h1>
          <p>Движение средств по школе</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Link className="btn ghost" href="/payments/daily">
          <Icon name="chart" size={15} />
          По дням
        </Link>
        {editor && (
          <ModalButton label="Принять оплату" title="Приём оплаты" icon="money" action={createPayment}>
            <PaymentForm students={students} subjects={subjects} />
          </ModalButton>
        )}
        </div>
      </div>

      <div className="grid kpis" style={{ marginBottom: 16 }}>
        {kpis.map((k) => (
          <div className="card kpi" key={k.l}>
            <div className="klabel">
              <span className="kico" style={{ background: k.bg, color: k.col }}>
                <Icon name={k.icon} size={16} />
              </span>
              {k.l}
            </div>
            <div className="kval num">{k.v}</div>
            {k.t && <div className="ktrend">{k.t}</div>}
          </div>
        ))}
      </div>

      <div className="toolbar">
        <div className="seg">
          {FILTERS.map((f) => (
            <Link key={f.key} href={`/payments?status=${f.key}`} className={status === f.key ? "on" : ""}>
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table {...cardCols(["Ученик", "Назначение", "Способ", "Период", "Статус", "Сумма", editor && ""])}>
            <thead>
              <tr>
                <th>Ученик</th>
                <th>Назначение</th>
                <th>Способ</th>
                <th>Период</th>
                <th>Статус</th>
                <th className="right">Сумма</th>
                {editor && <th></th>}
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr>
                  <td colSpan={editor ? 7 : 6}>
                    <div className="empty">Нет оплат по этому фильтру</div>
                  </td>
                </tr>
              )}
              {payments.map((p) => {
                const ps = PAYMENT_STATUS[p.status] ?? PAYMENT_STATUS.PAID;
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="person">
                        <div className="av2" style={{ background: avatarColor(p.student.name) }}>
                          {initials(p.student.name)}
                        </div>
                        <div className="nm">{p.student.name}</div>
                      </div>
                    </td>
                    <td className="td-text">{p.purpose}</td>
                    <td className="mut">{p.method ?? "—"}</td>
                    <td className="mut">{invoicePeriodLabel(p)}</td>
                    <td>
                      <span className={`chip ${ps.cls}`}>
                        <span className="d" />
                        {ps.label}
                      </span>
                    </td>
                    <td className="right money num" style={{ color: p.status === "PAID" ? "var(--ok)" : p.status === "OVERDUE" ? "var(--bad)" : "var(--ink)" }}>
                      {money(p.amount)}
                      {p.paidAmount > 0 && p.paidAmount < p.amount && (
                        <div className="mut" style={{ fontSize: 11.5, fontWeight: 500 }}>
                          принято {money(p.paidAmount)} · остаток {money(p.amount - p.paidAmount)}
                        </div>
                      )}
                      {p.refundedAmount > 0 && (
                        <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--bad)" }}>
                          возврат {money(p.refundedAmount)}
                        </div>
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
                            title={`Исправить оплату · ${p.student.name}`}
                            icon="edit"
                            buttonClass="btn ghost"
                            action={updatePayment.bind(null, p.id)}
                          >
                            <PaymentEditForm
                              students={students}
                              subjects={subjects}
                              canFixReceived={canFixReceived(p)}
                              value={{
                                studentId: p.studentId,
                                purpose: p.purpose,
                                amount: p.amount,
                                paidAmount: p.paidAmount,
                                method: p.method,
                                date: p.date,
                                months: p.months,
                                studyMonth: p.studyMonth,
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
        {pages > 1 && (
          <nav aria-label="Страницы" style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderTop: "1px solid var(--line-2)", flexWrap: "wrap" }}>
            <span className="mut num" style={{ fontSize: 12.5, marginRight: "auto" }}>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} из {total}
            </span>
            {page > 1 ? (
              <Link className="btn ghost" href={pageHref(page - 1)}>← Новее</Link>
            ) : null}
            <span className="mut num" style={{ fontSize: 12.5 }}>стр. {page} / {pages}</span>
            {page < pages ? (
              <Link className="btn ghost" href={pageHref(page + 1)}>Старше →</Link>
            ) : null}
          </nav>
        )}
      </div>
    </>
  );
}
