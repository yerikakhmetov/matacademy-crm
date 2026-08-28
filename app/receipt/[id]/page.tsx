import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canSeeMoney } from "@/lib/roles";
import { money, PAYMENT_STATUS } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const longDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} г.`;

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canSeeMoney(session.user.role)) redirect("/dashboard");

  const payment = await prisma.payment.findUnique({ where: { id }, include: { student: { include: { group: true } } } });
  if (!payment) notFound();

  const ps = PAYMENT_STATUS[payment.status] ?? PAYMENT_STATUS.PAID;
  const number = `${payment.date.getFullYear()}-${payment.id.slice(-6).toUpperCase()}`;

  return (
    <div className="receipt-page">
      <div className="receipt-toolbar">
        <Link href="/payments" className="btn ghost">
          ← К оплатам
        </Link>
        <PrintButton />
      </div>

      <div className="receipt">
        <div className="receipt-head">
          <div className="receipt-brand">
            <div className="logo" style={{ width: 44, height: 44 }}>
              <Icon name="book" size={24} style={{ color: "#fff" }} />
            </div>
            <div>
              <b>МатАкадемия</b>
              <span>Офлайн-школа математики · г. Алматы, ул. Абая</span>
            </div>
          </div>
          <div className="receipt-num">
            <div className="rn-label">Квитанция</div>
            <div className="rn-value num">№ {number}</div>
          </div>
        </div>

        <h1 className="receipt-title">Квитанция об оплате</h1>
        <p className="receipt-date">от {longDate(payment.date)}</p>

        <table className="receipt-table">
          <tbody>
            <tr>
              <td>Ученик</td>
              <td>{payment.student.name}</td>
            </tr>
            <tr>
              <td>Группа</td>
              <td>{payment.student.group?.name ?? "—"}</td>
            </tr>
            <tr>
              <td>Плательщик</td>
              <td>{payment.student.parentName ?? "—"}</td>
            </tr>
            <tr>
              <td>Назначение платежа</td>
              <td>{payment.purpose}</td>
            </tr>
            <tr>
              <td>Способ оплаты</td>
              <td>{payment.method ?? "—"}</td>
            </tr>
            <tr>
              <td>Статус</td>
              <td>{ps.label}</td>
            </tr>
          </tbody>
        </table>

        <div className="receipt-total">
          <span>Сумма к оплате</span>
          <span className="num">{money(payment.amount)}</span>
        </div>

        {payment.status === "PAID" && <div className="receipt-stamp">ОПЛАЧЕНО</div>}

        <div className="receipt-foot">
          <div>
            <div className="rf-label">Принял</div>
            <div className="rf-line">{session.user.name}</div>
          </div>
          <div>
            <div className="rf-label">Подпись</div>
            <div className="rf-line" />
          </div>
        </div>

        <p className="receipt-note">
          Документ сформирован автоматически в CRM МатАкадемии. Квитанция № {number} · {longDate(payment.date)}.
        </p>
      </div>
    </div>
  );
}
