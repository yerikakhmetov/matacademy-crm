import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";
import { requireAccess, getAccess } from "@/lib/access";
import { gatherPayroll } from "@/lib/payroll";
import { getSettings } from "@/lib/settings";
import { isTeacher } from "@/lib/teacher";
import { money, initials, avatarColor } from "@/lib/format";
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
  await requireAccess("reports");
  const money$ = (await getAccess()).can("finance"); // деньги в отчётах — только при доступе к финансам

  const months = lastMonths(6);
  const since = new Date(months[0].year, months[0].month0, 1);

  const [paidPayments, leads, students] = await Promise.all([
    prisma.payment.findMany({ where: { status: "PAID", date: { gte: since } }, select: { amount: true, date: true, method: true, student: { select: { groups: { select: { id: true } } } } } }),
    prisma.lead.findMany({ select: { source: true, stage: true, createdAt: true } }),
    prisma.student.findMany({
      select: { id: true, name: true, status: true, balance: true, attendance: true, groups: { select: { name: true } }, grades: { select: { score: true, maxScore: true } } },
    }),
  ]);
  const feePct = (await getSettings()).schoolFeePct;
  const expensesPeriod = money$
    ? await prisma.expense.findMany({ where: { date: { gte: since } }, select: { amount: true, date: true } })
    : [];
  const expenseByMonth = new Map<string, number>();
  for (const e of expensesPeriod) {
    const k = monthKey(e.date);
    expenseByMonth.set(k, (expenseByMonth.get(k) ?? 0) + e.amount);
  }
  // Живой фонд зарплаты по каждому месяцу (по посещаемости), только при доступе к финансам
  const liveTotals: number[] = money$
    ? (await Promise.all(months.map((m) => gatherPayroll(m.year, m.month0, feePct)))).map((map) => {
        let s = 0;
        for (const r of map.values()) s += r.salary;
        return s;
      })
    : months.map(() => 0);

  // Фактически собранный доход по предметам (по оплаченным платежам за период)
  const payItemsPeriod = money$
    ? await prisma.paymentItem.findMany({
        where: { payment: { status: "PAID", date: { gte: since } } },
        select: { subjectId: true, subjectName: true, amount: true, payment: { select: { date: true } } },
      })
    : [];
  // Зафиксированные зарплаты (для закрытых месяцев берём их вместо живого расчёта)
  const payrollRecords = money$
    ? await prisma.payrollRecord.findMany({ where: { year: { gte: since.getFullYear() } }, select: { year: true, month: true, salary: true } })
    : [];
  const lockedPayroll = new Map<string, number>(); // `${year}-${month0}` -> сумма
  for (const r of payrollRecords) {
    const k = `${r.year}-${r.month}`;
    lockedPayroll.set(k, (lockedPayroll.get(k) ?? 0) + r.salary);
  }

  // Доход по месяцам
  const revByMonth = months.map((m) => ({
    label: m.label,
    value: paidPayments.filter((p) => monthKey(p.date) === m.key).reduce((a, p) => a + p.amount, 0),
  }));
  const totalRev = revByMonth.reduce((a, m) => a + m.value, 0);

  // Прибыль по месяцам: доход − фонд зарплаты
  const profitRows = months.map((m, idx) => {
    const rev = revByMonth.find((r) => r.label === m.label)?.value ?? 0;
    const mk = `${m.year}-${m.month0}`;
    const payroll = lockedPayroll.has(mk) ? (lockedPayroll.get(mk) ?? 0) : liveTotals[idx];
    const expenses = expenseByMonth.get(m.key) ?? 0;
    return { label: m.label, rev, payroll, expenses, profit: rev - payroll - expenses };
  });
  const totalPayroll = profitRows.reduce((a, r) => a + r.payroll, 0);
  const totalExpenses = profitRows.reduce((a, r) => a + r.expenses, 0);
  const totalProfit = totalRev - totalPayroll - totalExpenses;

  // Ученики на контроле (риск): низкая посещаемость, долг или низкие оценки
  const riskStudents = students
    .filter((s) => s.status === "ACTIVE")
    .map((s) => {
      const avg = s.grades.length ? Math.round(s.grades.reduce((a, g) => a + (g.score / g.maxScore) * 100, 0) / s.grades.length) : null;
      const reasons: string[] = [];
      if (s.attendance != null && s.attendance < 70) reasons.push(`посещаемость ${s.attendance}%`);
      if (s.balance < 0) reasons.push(`долг ${money(s.balance)}`);
      if (avg != null && avg < 60) reasons.push(`средний балл ${avg}%`);
      return { s, avg, reasons };
    })
    .filter((r) => r.reasons.length > 0)
    .sort((a, b) => b.reasons.length - a.reasons.length);

  // Способы оплаты
  const methodMap = new Map<string, number>();
  for (const p of paidPayments) {
    const k = p.method || "Другое";
    methodMap.set(k, (methodMap.get(k) ?? 0) + p.amount);
  }
  const methods = [...methodMap.entries()].sort((a, b) => b[1] - a[1]);
  const methodMax = Math.max(1, ...methods.map((m) => m[1]));

  // Доход по предметам (фактически собранный — из оплаченных платежей за период)
  const subjRevMap = new Map<string, number>();
  for (const it of payItemsPeriod) subjRevMap.set(it.subjectName, (subjRevMap.get(it.subjectName) ?? 0) + it.amount);
  const subjectRev = [...subjRevMap.entries()].sort((a, b) => b[1] - a[1]);
  const subjectRevTotal = subjectRev.reduce((a, [, v]) => a + v, 0);
  const subjectMax = Math.max(1, ...subjectRev.map(([, v]) => v));

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
  const attRated = students.filter((s) => s.attendance != null);
  const avgAtt = attRated.length ? Math.round(attRated.reduce((a, s) => a + (s.attendance ?? 0), 0) / attRated.length) : null;

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
          <div className="kval num">{avgAtt == null ? "—" : `${avgAtt}%`}</div>
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

      {money$ && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-h">
            <h3>Доход по предметам</h3>
            <span className="chip c-mut"><span className="d" />Итого: {money(subjectRevTotal)}</span>
          </div>
          <div className="funnel">
            {subjectRev.length === 0 && <div className="empty">Нет оплат с отмеченными предметами за период</div>}
            {subjectRev.map(([name, sum]) => (
              <div className="frow" key={name}>
                <div className="fl">{name}</div>
                <div className="ftrack">
                  <div className="ffill" style={{ width: `${Math.round((sum / subjectMax) * 100)}%`, background: "var(--violet)" }} />
                </div>
                <div className="fv num" style={{ width: 120 }}>
                  {money(sum)}
                  <span className="mut" style={{ fontSize: 11, marginLeft: 6 }}>
                    {subjectRevTotal > 0 ? Math.round((sum / subjectRevTotal) * 100) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {money$ && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-h">
            <h3>Прибыль по месяцам</h3>
            <span className={`chip ${totalProfit >= 0 ? "c-ok" : "c-bad"}`}>
              <span className="d" />
              Итого: {money(totalProfit)}
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Месяц</th>
                  <th className="right">Доход</th>
                  <th className="right">Зарплата</th>
                  <th className="right">Расходы</th>
                  <th className="right">Прибыль</th>
                </tr>
              </thead>
              <tbody>
                {profitRows.map((r) => (
                  <tr key={r.label}>
                    <td style={{ fontWeight: 600, textTransform: "capitalize" }}>{r.label}</td>
                    <td className="right money num" style={{ color: "var(--ok)" }}>{money(r.rev)}</td>
                    <td className="right money num" style={{ color: "var(--ink-2)" }}>−{money(r.payroll)}</td>
                    <td className="right money num" style={{ color: "var(--ink-2)" }}>−{money(r.expenses)}</td>
                    <td className="right money num" style={{ color: r.profit >= 0 ? "var(--ok)" : "var(--bad)" }}>{money(r.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mut" style={{ fontSize: 12, padding: "10px 18px 16px", margin: 0 }}>
            Зарплата считается по посещаемости (раздел «Зарплата»), расходы вносятся в разделе «Расходы».
            Прибыль = доход − фонд зарплаты − расходы.
          </p>
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

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h">
          <h3>Ученики на контроле</h3>
          <span className={`chip ${riskStudents.length ? "c-bad" : "c-ok"}`}>
            <span className="d" />
            {riskStudents.length}
          </span>
        </div>
        <div style={{ padding: "6px 0" }}>
          {riskStudents.length === 0 && <div className="empty">Все ученики в норме ✅</div>}
          {riskStudents.map(({ s, reasons }) => (
            <Link key={s.id} href={`/students/${s.id}`} className="list-row" style={{ textDecoration: "none" }}>
              <div className="av2" style={{ background: avatarColor(s.name), width: 32, height: 32, fontSize: 12 }}>
                {initials(s.name)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div className="mut" style={{ fontSize: 12 }}>{s.groups.length ? s.groups.map((g) => g.name).join(", ") : "без группы"}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 360 }}>
                {reasons.map((r, i) => (
                  <span key={i} className="chip c-bad" style={{ fontSize: 11 }}>
                    <span className="d" />
                    {r}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
        <p className="mut" style={{ fontSize: 12, padding: "6px 18px 16px", margin: 0 }}>
          Показаны активные ученики с посещаемостью ниже 70%, долгом или средним баллом ниже 60%. Нажмите, чтобы открыть карточку.
        </p>
      </div>
    </>
  );
}
