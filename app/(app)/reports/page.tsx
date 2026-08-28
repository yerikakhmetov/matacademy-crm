import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canSeeMoney } from "@/lib/roles";
import { isTeacher } from "@/lib/teacher";
import { money } from "@/lib/format";
import { BarChart } from "@/components/BarChart";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

// Последние N месяцев как [{key:'2026-08', label:'авг', year, month0}]
function lastMonths(count: number) {
  const now = new Date();
  const arr = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTHS[d.getMonth()], year: d.getFullYear(), month0: d.getMonth() });
  }
  return arr;
}
const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

export default async function ReportsPage() {
  const session = await auth();
  if (isTeacher(session?.user?.role)) redirect("/dashboard");
  const money$ = canSeeMoney(session?.user?.role);

  const months = lastMonths(6);
  const since = new Date(months[0].year, months[0].month0, 1);

  const [paidPayments, leads, students] = await Promise.all([
    prisma.payment.findMany({ where: { status: "PAID", date: { gte: since } }, select: { amount: true, date: true, method: true } }),
    prisma.lead.findMany({ select: { source: true, stage: true, createdAt: true } }),
    prisma.student.findMany({ select: { status: true, balance: true, attendance: true } }),
  ]);

  // Доход по месяцам
  const revByMonth = months.map((m) => ({
    label: m.label,
    value: paidPayments.filter((p) => monthKey(p.date) === m.key).reduce((a, p) => a + p.amount, 0),
  }));
  const totalRev = revByMonth.reduce((a, m) => a + m.value, 0);

  // Способы оплаты
  const methodMap = new Map<string, number>();
  for (const p of paidPayments) {
    const k = p.method || "Другое";
    methodMap.set(k, (methodMap.get(k) ?? 0) + p.amount);
  }
  const methods = [...methodMap.entries()].sort((a, b) => b[1] - a[1]);
  const methodMax = Math.max(1, ...methods.map((m) => m[1]));

  // Новые лиды по месяцам
  const leadsByMonth = months.map((m) => ({
    label: m.label,
    value: leads.filter((l) => monthKey(l.createdAt) === m.key).length,
  }));

  // Конверсия по источникам
  const srcMap = new Map<string, { total: number; won: number }>();
  for (const l of leads) {
    const k = l.source ?? "Без источника";
    const s = srcMap.get(k) ?? { total: 0, won: 0 };
    s.total++;
    if (l.stage === "WON") s.won++;
    srcMap.set(k, s);
  }
  const sources = [...srcMap.entries()].sort((a, b) => b[1].total - a[1].total);

  // Статистика учеников
  const active = students.filter((s) => s.status === "ACTIVE").length;
  const paused = students.filter((s) => s.status === "PAUSED").length;
  const debtors = students.filter((s) => s.balance < 0);
  const totalDebt = debtors.reduce((a, s) => a + s.balance, 0);
  const avgAtt = students.length ? Math.round(students.reduce((a, s) => a + s.attendance, 0) / students.length) : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Отчёты и аналитика</h1>
          <p>Динамика за последние 6 месяцев</p>
        </div>
        {money$ && (
          <div style={{ display: "flex", gap: 10 }}>
            <a className="btn ghost" href="/api/export/students" download>
              <Icon name="export" size={16} />
              Ученики → Excel
            </a>
            <a className="btn ghost" href="/api/export/payments" download>
              <Icon name="export" size={16} />
              Оплаты → Excel
            </a>
          </div>
        )}
      </div>

      {/* Сводные показатели */}
      <div className="grid kpis">
        {money$ && (
          <div className="card kpi">
            <div className="klabel">
              <span className="kico" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>
                <Icon name="money" size={16} />
              </span>
              Доход за 6 мес
            </div>
            <div className="kval num">{money(totalRev)}</div>
          </div>
        )}
        <div className="card kpi">
          <div className="klabel">
            <span className="kico" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              <Icon name="students" size={16} />
            </span>
            Ученики
          </div>
          <div className="kval num">{active}</div>
          <div className="ktrend">активных · {paused} на паузе</div>
        </div>
        <div className="card kpi">
          <div className="klabel">
            <span className="kico" style={{ background: "var(--violet-soft)", color: "var(--violet)" }}>
              <Icon name="check" size={16} />
            </span>
            Средняя посещаемость
          </div>
          <div className="kval num">{avgAtt}%</div>
        </div>
        {money$ && (
          <div className="card kpi">
            <div className="klabel">
              <span className="kico" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>
                <Icon name="alert" size={16} />
              </span>
              Задолженность
            </div>
            <div className="kval num">{money(totalDebt)}</div>
            <div className="ktrend">{debtors.length} учеников</div>
          </div>
        )}
      </div>

      {money$ && (
        <div className="two-col" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="card-h">
              <h3>Доход по месяцам</h3>
              <span className="chip c-ok">
                <span className="d" />
                {money(totalRev)}
              </span>
            </div>
            <div style={{ padding: 18 }}>
              <BarChart data={revByMonth} color="var(--ok)" formatValue={(n) => (n >= 1000 ? Math.round(n / 1000) + "к" : String(n))} />
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h3>Способы оплаты</h3>
            </div>
            <div className="funnel">
              {methods.length === 0 && <div className="empty">Нет оплат за период</div>}
              {methods.map(([name, sum]) => (
                <div className="frow" key={name}>
                  <div className="fl">{name}</div>
                  <div className="ftrack">
                    <div className="ffill" style={{ width: `${Math.round((sum / methodMax) * 100)}%`, background: "var(--accent)" }} />
                  </div>
                  <div className="fv num" style={{ width: 90 }}>
                    {money(sum)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="two-col" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-h">
            <h3>Новые лиды по месяцам</h3>
          </div>
          <div style={{ padding: 18 }}>
            <BarChart data={leadsByMonth} color="var(--violet)" />
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>Конверсия по источникам</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Источник</th>
                  <th className="right">Лидов</th>
                  <th className="right">Оплатили</th>
                  <th className="right">Конверсия</th>
                </tr>
              </thead>
              <tbody>
                {sources.map(([name, s]) => {
                  const pct = s.total ? Math.round((s.won / s.total) * 100) : 0;
                  const c = pct >= 40 ? "var(--ok)" : pct >= 20 ? "var(--warn)" : "var(--bad)";
                  return (
                    <tr key={name}>
                      <td style={{ fontWeight: 600 }}>{name}</td>
                      <td className="right num">{s.total}</td>
                      <td className="right num">{s.won}</td>
                      <td className="right num" style={{ fontWeight: 700, color: c }}>
                        {pct}%
                      </td>
                    </tr>
                  );
                })}
                {sources.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <div className="empty">Пока нет лидов</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
