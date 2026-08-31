import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData, requireAccess } from "@/lib/access";
import { isTeacher } from "@/lib/teacher";
import { money, initials, avatarColor, formatDate, PAYMENT_STATUS } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { ModalButton } from "@/components/ModalButton";
import { PaymentForm } from "./PaymentForm";
import { MarkPaidButton } from "@/components/MarkPaidButton";
import { createPayment, refreshOverdue } from "@/app/actions/data";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "Все" },
  { key: "PAID", label: "Оплачено" },
  { key: "PENDING", label: "Ожидают" },
  { key: "OVERDUE", label: "Долги" },
];

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "all" } = await searchParams;
  const session = await auth();
  if (isTeacher(session?.user?.role)) redirect("/dashboard");
  await requireAccess("finance");
  const editor = await canEditData(session?.user?.role);

  await refreshOverdue(); // автопометка просроченных счетов

  const where = status === "all" ? {} : { status };

  const [payments, students, paidAgg, pendingAgg, overdueAgg, paidCount] = await Promise.all([
    prisma.payment.findMany({ where, include: { student: true }, orderBy: { date: "desc" } }),
    prisma.student.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID", date: { gte: monthStart() } } }),
    prisma.payment.aggregate({ _sum: { amount: true }, _count: true, where: { status: "PENDING" } }),
    prisma.payment.aggregate({ _sum: { amount: true }, _count: true, where: { status: "OVERDUE" } }),
    prisma.payment.count({ where: { status: "PAID", date: { gte: monthStart() } } }),
  ]);

  const revenue = paidAgg._sum.amount ?? 0;
  const avg = paidCount > 0 ? Math.round(revenue / paidCount) : 0;

  const kpis = [
    { l: "Поступило за месяц", v: money(revenue), icon: "check", col: "var(--ok)", bg: "var(--ok-soft)" },
    { l: "Ожидается", v: money(pendingAgg._sum.amount ?? 0), t: `${pendingAgg._count} счетов`, icon: "clock", col: "var(--warn)", bg: "var(--warn-soft)" },
    { l: "Просрочено", v: money(overdueAgg._sum.amount ?? 0), t: `${overdueAgg._count} учеников`, icon: "alert", col: "var(--bad)", bg: "var(--bad-soft)" },
    { l: "Средний чек", v: money(avg), icon: "chart", col: "var(--accent)", bg: "var(--accent-soft)" },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Оплаты и абонементы</h1>
          <p>Движение средств по школе</p>
        </div>
        {editor && (
          <ModalButton label="Принять оплату" title="Приём оплаты" icon="money" action={createPayment}>
            <PaymentForm students={students} />
          </ModalButton>
        )}
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
          <table>
            <thead>
              <tr>
                <th>Ученик</th>
                <th>Назначение</th>
                <th>Способ</th>
                <th>Дата</th>
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
                    <td>{p.purpose}</td>
                    <td className="mut">{p.method ?? "—"}</td>
                    <td className="mut">{formatDate(p.date)}</td>
                    <td>
                      <span className={`chip ${ps.cls}`}>
                        <span className="d" />
                        {ps.label}
                      </span>
                    </td>
                    <td className="right money num" style={{ color: p.status === "PAID" ? "var(--ok)" : p.status === "OVERDUE" ? "var(--bad)" : "var(--ink)" }}>
                      {money(p.amount)}
                    </td>
                    {editor && (
                      <td className="right">
                        {p.status === "PAID" ? (
                          <Link className="btn ghost" href={`/receipt/${p.id}`} style={{ padding: "5px 11px", fontSize: 12.5 }}>
                            <Icon name="export" size={14} />
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
    </>
  );
}
