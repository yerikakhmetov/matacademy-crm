import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";
import { requireAccess, getAccess } from "@/lib/access";
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

// Сколько занятий с данным днём недели в месяце
function lessonsInMonth(year: number, month0: number, dayOfWeek: number): number {
  let c = 0;
  const d = new Date(Date.UTC(year, month0, 1));
  while (d.getUTCMonth() === month0) {
    const js = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    if (js === dayOfWeek) c++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return c;
}

export default async function ReportsPage() {
  const session = await auth();
  if (isTeacher(session?.user?.role)) redirect("/dashboard");
  await requireAccess("reports");
  const money$ = (await getAccess()).can("finance"); // деньги в отчётах — только при доступе к финансам

  const months = lastMonths(6);
  const since = new Date(months[0].year, months[0].month0, 1);

  const [paidPayments, leads, students, teachers] = await Promise.all([
    prisma.payment.findMany({ where: { status: "PAID", date: { gte: since } }, select: { amount: true, date: true, method: true, student: { select: { groupId: true } } } }),
    prisma.lead.findMany({ select: { source: true, stage: true, createdAt: true } }),
    prisma.student.findMany({
      select: { id: true, name: true, status: true, balance: true, attendance: true, group: { select: { name: true } }, grades: { select: { score: true, maxScore: true } } },
    }),
    money$
      ? prisma.teacher.findMany({ select: { rate: true, rateType: true, subjects: { select: { id: true } }, groups: { select: { id: true, lessons: { select: { dayOfWeek: true } }, _count: { select: { students: true } } } } } })
      : Promise.resolve([]),
  ]);

  // Доли предметов по абонементам за период (для PERCENT_SUBJECT в расчёте зарплаты)
  const subjItemsPeriod = money$
    ? await prisma.subscriptionItem.findMany({
        where: { subscription: { startDate: { gte: since } } },
        select: { subjectId: true, amount: true, subscription: { select: { startDate: true } } },
      })
    : [];
  const revBySubjectMonth = new Map<string, number>(); // `${subjectId}|${key}` -> сумма
  for (const it of subjItemsPeriod) {
    if (it.subjectId) {
      const k = `${it.subjectId}|${monthKey(it.subscription.startDate)}`;
      revBySubjectMonth.set(k, (revBySubjectMonth.get(k) ?? 0) + it.amount);
    }
  }

  // Доход по месяцам
  const revByMonth = months.map((m) => ({
    label: m.label,
    value: paidPayments.filter((p) => monthKey(p.date) === m.key).reduce((a, p) => a + p.amount, 0),
  }));
  const totalRev = revByMonth.reduce((a, m) => a + m.value, 0);

  // Прибыль по месяцам: доход − фонд зарплаты
  const revByGroupMonth = new Map<string, number>(); // `${gid}|${key}` -> сумма
  for (const p of paidPayments) {
    const gid = p.student.groupId;
    if (gid) {
      const k = `${gid}|${monthKey(p.date)}`;
      revByGroupMonth.set(k, (revByGroupMonth.get(k) ?? 0) + p.amount);
    }
  }
  function payrollForMonth(m: { key: string; year: number; month0: number }): number {
    let total = 0;
    for (const t of teachers) {
      if (t.rateType === "PER_STUDENT") {
        total += t.groups.reduce((a, g) => a + g._count.students, 0) * t.rate;
      } else if (t.rateType === "PERCENT") {
        const rev = t.groups.reduce((a, g) => a + (revByGroupMonth.get(`${g.id}|${m.key}`) ?? 0), 0);
        total += Math.round((rev * t.rate) / 100);
      } else if (t.rateType === "PERCENT_SUBJECT") {
        const rev = t.subjects.reduce((a, s) => a + (revBySubjectMonth.get(`${s.id}|${m.key}`) ?? 0), 0);
        total += Math.round((rev * t.rate) / 100);
      } else {
        const lessons = t.groups.reduce((a, g) => a + g.lessons.reduce((la, l) => la + lessonsInMonth(m.year, m.month0, l.dayOfWeek), 0), 0);
        total += lessons * t.rate;
      }
    }
    return total;
  }
  const profitRows = months.map((m) => {
    const rev = revByMonth.find((r) => r.label === m.label)?.value ?? 0;
    const payroll = payrollForMonth(m);
    return { label: m.label, rev, payroll, profit: rev - payroll };
  });
  const totalPayroll = profitRows.reduce((a, r) => a + r.payroll, 0);
  const totalProfit = totalRev - totalPayroll;

  // Ученики на контроле (риск): низкая посещаемость, долг или низкие оценки
  const riskStudents = students
    .filter((s) => s.status === "ACTIVE")
    .map((s) => {
      const avg = s.grades.length ? Math.round(s.grades.reduce((a, g) => a + (g.score / g.maxScore) * 100, 0) / s.grades.length) : null;
      const reasons: string[] = [];
      if (s.attendance < 70) reasons.push(`посещаемость ${s.attendance}%`);
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

  // Доход по предметам (доли проданных абонементов за период)
  const subjectItems = money$
    ? await prisma.subscriptionItem.findMany({
        where: { subscription: { startDate: { gte: since } } },
        select: { subjectName: true, amount: true },
      })
    : [];
  const subjRevMap = new Map<string, number>();
  for (const it of subjectItems) subjRevMap.set(it.subjectName, (subjRevMap.get(it.subjectName) ?? 0) + it.amount);
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

      {money$ && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-h">
            <h3>Доход по предметам</h3>
            <span className="chip c-mut"><span className="d" />Итого: {money(subjectRevTotal)}</span>
          </div>
          <div className="funnel">
            {subjectRev.length === 0 && <div className="empty">Нет абонементов с предметами за период</div>}
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
                  <th className="right">Прибыль</th>
                </tr>
              </thead>
              <tbody>
                {profitRows.map((r) => (
                  <tr key={r.label}>
                    <td style={{ fontWeight: 600, textTransform: "capitalize" }}>{r.label}</td>
                    <td className="right money num" style={{ color: "var(--ok)" }}>{money(r.rev)}</td>
                    <td className="right money num" style={{ color: "var(--ink-2)" }}>−{money(r.payroll)}</td>
                    <td className="right money num" style={{ color: r.profit >= 0 ? "var(--ok)" : "var(--bad)" }}>{money(r.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mut" style={{ fontSize: 12, padding: "10px 18px 16px", margin: 0 }}>
            Зарплата считается по ставкам преподавателей (раздел «Зарплата»). Прибыль = доход − фонд зарплаты.
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
                <div className="mut" style={{ fontSize: 12 }}>{s.group?.name ?? "без группы"}</div>
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
