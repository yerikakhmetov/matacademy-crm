import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireAccess } from "@/lib/access";
import { isTeacher } from "@/lib/teacher";
import { getSettings } from "@/lib/settings";
import { groupByDay, dayKeyInTz } from "@/lib/daily";
import { money, initials, avatarColor } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { BarChart } from "@/components/BarChart";

export const dynamic = "force-dynamic";

const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const MONTHS_FULL = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

// Последние 12 месяцев для переключателя: [{key:'2026-9', label:'сен 26'}]
function lastMonths(n: number) {
  const now = new Date();
  const arr: { key: string; label: string; year: number; month0: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      year: d.getFullYear(),
      month0: d.getMonth(),
    });
  }
  return arr;
}

export default async function DailyPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const session = await auth();
  if (isTeacher(session?.user?.role)) redirect("/dashboard");
  await requireAccess("finance");

  const months = lastMonths(12);
  const current = months.find((x) => x.key === m) ?? months[months.length - 1];
  const tz = (await getSettings()).tzOffsetHours;

  // Границы месяца берём в часовом поясе школы, поэтому запрашиваем в UTC
  // со сдвигом: местная полночь 1-го числа — это 1-е минус tz часов по UTC.
  const from = new Date(Date.UTC(current.year, current.month0, 1, -tz, 0, 0));
  const to = new Date(Date.UTC(current.year, current.month0 + 1, 1, -tz, 0, 0));

  const txs = await prisma.paymentTx.findMany({
    where: { date: { gte: from, lt: to } },
    orderBy: { date: "desc" },
    select: {
      id: true,
      kind: true,
      amount: true,
      date: true,
      method: true,
      note: true,
      payment: {
        select: {
          id: true,
          method: true,
          purpose: true,
          student: { select: { id: true, name: true } },
        },
      },
    },
  });

  const days = groupByDay(txs, tz);

  const income = days.reduce((a, d) => a + d.income, 0);
  const refund = days.reduce((a, d) => a + d.refund, 0);
  const net = income - refund;
  const activeDays = days.filter((d) => d.count > 0).length;
  const avgPerDay = activeDays > 0 ? Math.round(net / activeDays) : 0;
  const best = days.reduce<(typeof days)[number] | null>((a, d) => (a && a.net >= d.net ? a : d), null);

  // График идёт слева направо по возрастанию дат — так привычнее читать месяц.
  const chart = [...days]
    .reverse()
    .map((d) => ({ label: d.day.slice(8), value: d.net }));

  const todayKey = dayKeyInTz(new Date(), tz);

  const kpis = [
    { l: "Поступило", v: money(income), icon: "check", col: "var(--ok)", bg: "var(--ok-soft)" },
    { l: "Возвраты", v: money(refund), icon: "alert", col: "var(--bad)", bg: "var(--bad-soft)", t: `${days.reduce((a, d) => a + d.items.filter((i) => i.kind === "REFUND").length, 0)} шт.` },
    { l: "Чистыми", v: money(net), icon: "money", col: "var(--accent)", bg: "var(--accent-soft)", t: `${activeDays} дней с оплатами` },
    { l: "В среднем за день", v: money(avgPerDay), icon: "chart", col: "var(--warn)", bg: "var(--warn-soft)", t: best && best.net > 0 ? `лучший — ${best.day.slice(8)}.${String(current.month0 + 1).padStart(2, "0")}` : undefined },
  ];

  const dayTitle = (key: string) => {
    const [y, mo, dd] = key.split("-").map(Number);
    // Дата собрана как UTC, поэтому и день недели читаем в UTC — без сдвига.
    const d = new Date(Date.UTC(y, mo - 1, dd));
    return { num: dd, weekday: WEEKDAYS[d.getUTCDay()], monthLabel: MONTHS[mo - 1] };
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Оплаты по дням</h1>
          <p>
            {MONTHS_FULL[current.month0]} {current.year} · движение денег по дням
          </p>
        </div>
        <Link className="btn ghost" href="/payments">
          <Icon name="money" size={15} />
          Все оплаты
        </Link>
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
        <div className="seg" style={{ overflowX: "auto" }}>
          {months.map((mm) => (
            <Link key={mm.key} href={`/payments/daily?m=${mm.key}`} className={mm.key === current.key ? "on" : ""}>
              {mm.label}
            </Link>
          ))}
        </div>
      </div>

      {chart.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-h">
            <h3>Динамика по дням</h3>
            <span className="chip c-mut">
              <span className="d" />
              {money(net)}
            </span>
          </div>
          <div style={{ padding: "12px 18px 8px" }}>
            <BarChart data={chart} formatValue={(n) => (n >= 1000 ? `${Math.round(n / 1000)}к` : String(n))} />
          </div>
        </div>
      )}

      {days.length === 0 && (
        <div className="card">
          <div className="empty">В этом месяце оплат не было</div>
        </div>
      )}

      {days.map((d) => {
        const info = dayTitle(d.day);
        const isToday = d.day === todayKey;
        return (
          <div className="card" key={d.day} style={{ marginBottom: 12 }}>
            <div className="card-h">
              <h3>
                {info.num} {info.monthLabel}
                <span className="mut" style={{ fontWeight: 500, marginLeft: 8, fontSize: 13 }}>
                  {info.weekday}
                  {isToday ? " · сегодня" : ""}
                </span>
              </h3>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {d.refund > 0 && (
                  <span className="chip c-bad">
                    <span className="d" />−{money(d.refund)}
                  </span>
                )}
                <span className="chip c-mut">
                  <span className="d" />
                  {d.count} оп.
                </span>
                <span className="chip c-ok">
                  <span className="d" />
                  {money(d.net)}
                </span>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ученик</th>
                    <th>Назначение</th>
                    <th>Способ</th>
                    <th>Время</th>
                    <th className="right">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {d.items.map((tx) => {
                    const isRefund = tx.kind === "REFUND";
                    // Время показываем в поясе школы — тем же сдвигом, что и день.
                    const local = new Date(tx.date.getTime() + tz * 3600_000);
                    const hh = String(local.getUTCHours()).padStart(2, "0");
                    const mi = String(local.getUTCMinutes()).padStart(2, "0");
                    return (
                      <tr key={tx.id}>
                        <td>
                          <Link href={`/students/${tx.payment.student.id}`} className="person" style={{ color: "inherit", textDecoration: "none" }}>
                            <div className="av2" style={{ background: avatarColor(tx.payment.student.name) }}>
                              {initials(tx.payment.student.name)}
                            </div>
                            <div className="nm">{tx.payment.student.name}</div>
                          </Link>
                        </td>
                        <td className="mut">{isRefund ? `Возврат · ${tx.payment.purpose}` : tx.payment.purpose}</td>
                        <td className="mut">{tx.method ?? tx.payment.method ?? "—"}</td>
                        <td className="mut num">
                          {hh}:{mi}
                        </td>
                        <td className="right num" style={{ fontWeight: 700, color: isRefund ? "var(--bad)" : "var(--ok)" }}>
                          {isRefund ? "−" : "+"}
                          {money(tx.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}
