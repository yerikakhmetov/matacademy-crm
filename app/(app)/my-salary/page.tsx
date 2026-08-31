import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isTeacher, getTeacherIdForUser } from "@/lib/teacher";
import { money, RATE_TYPE } from "@/lib/format";
import { MonthSelect } from "../payroll/PayrollControls";

export const dynamic = "force-dynamic";

const MONTH_NAMES = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function datesInMonth(year: number, month0: number, dayOfWeek: number): number {
  let count = 0;
  const d = new Date(Date.UTC(year, month0, 1));
  while (d.getUTCMonth() === month0) {
    const js = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    if (js === dayOfWeek) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

const mKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

export default async function MySalaryPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  if (!isTeacher(session?.user?.role)) redirect("/dashboard");
  const teacherId = await getTeacherIdForUser(session?.user?.id);

  const now = new Date();
  const monthOpts = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { id: `${d.getFullYear()}-${d.getMonth()}`, name: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`, year: d.getFullYear(), month0: d.getMonth() };
  });
  const sel = (sp.month && monthOpts.find((m) => m.id === sp.month)) || monthOpts[0];

  if (!teacherId) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Моя зарплата</h1>
            <p>Расчёт вознаграждения по вашей ставке</p>
          </div>
        </div>
        <div className="card">
          <div className="empty">Профиль преподавателя не привязан к аккаунту. Обратитесь к администратору.</div>
        </div>
      </>
    );
  }

  const since = new Date(monthOpts[monthOpts.length - 1].year, monthOpts[monthOpts.length - 1].month0, 1);

  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: {
      groups: { include: { _count: { select: { students: true } }, lessons: { select: { dayOfWeek: true } } } },
      subjects: { select: { id: true, name: true, color: true } },
    },
  });
  if (!teacher) redirect("/dashboard");

  const groupIds = teacher.groups.map((g) => g.id);
  const subjectIds = teacher.subjects.map((s) => s.id);

  const [paidPayments, subjItems] = await Promise.all([
    teacher.rateType === "PERCENT" && groupIds.length
      ? prisma.payment.findMany({
          where: { status: "PAID", date: { gte: since }, student: { groupId: { in: groupIds } } },
          select: { amount: true, date: true, student: { select: { groupId: true } } },
        })
      : Promise.resolve([] as { amount: number; date: Date; student: { groupId: string | null } }[]),
    teacher.rateType === "PERCENT_SUBJECT" && subjectIds.length
      ? prisma.subscriptionItem.findMany({
          where: { subjectId: { in: subjectIds }, subscription: { startDate: { gte: since } } },
          select: { subjectId: true, amount: true, subscription: { select: { startDate: true } } },
        })
      : Promise.resolve([] as { subjectId: string | null; amount: number; subscription: { startDate: Date } }[]),
  ]);

  const revByGroupMonth = new Map<string, number>();
  for (const p of paidPayments) {
    if (p.student.groupId) {
      const k = `${p.student.groupId}|${mKey(p.date)}`;
      revByGroupMonth.set(k, (revByGroupMonth.get(k) ?? 0) + p.amount);
    }
  }
  const revBySubjectMonth = new Map<string, number>();
  for (const it of subjItems) {
    if (it.subjectId) {
      const k = `${it.subjectId}|${mKey(it.subscription.startDate)}`;
      revBySubjectMonth.set(k, (revBySubjectMonth.get(k) ?? 0) + it.amount);
    }
  }

  const rt = RATE_TYPE[teacher.rateType] ?? RATE_TYPE.PER_LESSON;

  function calc(m: { key: string; year: number; month0: number }) {
    if (teacher!.rateType === "PER_STUDENT") {
      const base = teacher!.groups.reduce((a, g) => a + g._count.students, 0);
      return { base, baseLabel: `${base} учеников`, salary: base * teacher!.rate };
    }
    if (teacher!.rateType === "PERCENT") {
      const rev = teacher!.groups.reduce((a, g) => a + (revByGroupMonth.get(`${g.id}|${m.key}`) ?? 0), 0);
      return { base: rev, baseLabel: money(rev), salary: Math.round((rev * teacher!.rate) / 100) };
    }
    if (teacher!.rateType === "PERCENT_SUBJECT") {
      const rev = teacher!.subjects.reduce((a, s) => a + (revBySubjectMonth.get(`${s.id}|${m.key}`) ?? 0), 0);
      return { base: rev, baseLabel: teacher!.subjects.length ? money(rev) : "нет предметов", salary: Math.round((rev * teacher!.rate) / 100) };
    }
    const lessons = teacher!.groups.reduce((a, g) => a + g.lessons.reduce((la, l) => la + datesInMonth(m.year, m.month0, l.dayOfWeek), 0), 0);
    return { base: lessons, baseLabel: `${lessons} уроков`, salary: lessons * teacher!.rate };
  }

  const selKey = { key: sel.id, year: sel.year, month0: sel.month0 };
  const cur = calc(selKey);
  const history = monthOpts.map((m) => ({ name: m.name, salary: calc({ key: m.id, year: m.year, month0: m.month0 }).salary }));
  const histMax = Math.max(1, ...history.map((h) => h.salary));

  // Разбивка по предметам (для PERCENT_SUBJECT)
  const subjBreakdown =
    teacher.rateType === "PERCENT_SUBJECT"
      ? teacher.subjects
          .map((s) => {
            const rev = revBySubjectMonth.get(`${s.id}|${sel.id}`) ?? 0;
            return { ...s, rev, pay: Math.round((rev * teacher.rate) / 100) };
          })
          .filter((s) => s.rev > 0)
      : [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Моя зарплата</h1>
          <p>Расчёт по вашей ставке за {sel.name}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600 }}>
            К выплате за месяц
          </div>
          <div className="kval num" style={{ fontSize: 26, color: cur.salary > 0 ? "var(--ok)" : "var(--ink-3)" }}>
            {money(cur.salary)}
          </div>
        </div>
      </div>

      <div className="toolbar">
        <MonthSelect months={monthOpts} month={sel.id} path="/my-salary" />
        <span className="proto-note">{rt.label}{teacher.rate ? ` · ${teacher.rateType === "PERCENT" || teacher.rateType === "PERCENT_SUBJECT" ? `${teacher.rate}%` : money(teacher.rate)}` : " · ставка не задана"}</span>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-h"><h3>Как рассчитано</h3></div>
          <div style={{ padding: 18 }}>
            <dl className="dl">
              <dt>Тип оплаты</dt>
              <dd>{rt.label}</dd>
              <dt>Ставка</dt>
              <dd>{teacher.rate ? (teacher.rateType === "PERCENT" || teacher.rateType === "PERCENT_SUBJECT" ? `${teacher.rate}%` : money(teacher.rate)) : "не задана"}</dd>
              <dt>База за месяц</dt>
              <dd>{cur.baseLabel}</dd>
              <dt>К выплате</dt>
              <dd style={{ fontWeight: 800, color: "var(--ok)" }}>{money(cur.salary)}</dd>
            </dl>
            {subjBreakdown.length > 0 && (
              <div style={{ marginTop: 8, borderTop: "1px solid var(--line-2)", paddingTop: 10 }}>
                <div className="mut" style={{ fontSize: 11.5, marginBottom: 6 }}>По предметам:</div>
                {subjBreakdown.map((s) => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                    <span>
                      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: s.color, marginRight: 7 }} />
                      {s.name} <span className="mut">({money(s.rev)})</span>
                    </span>
                    <span className="num" style={{ fontWeight: 600 }}>{money(s.pay)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Последние 6 месяцев</h3></div>
          <div className="funnel" style={{ padding: 14 }}>
            {history.map((h) => (
              <div className="frow" key={h.name}>
                <div className="fl" style={{ width: 90 }}>{h.name}</div>
                <div className="ftrack">
                  <div className="ffill" style={{ width: `${Math.round((h.salary / histMax) * 100)}%`, background: "var(--ok)" }} />
                </div>
                <div className="fv num" style={{ width: 100 }}>{money(h.salary)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mut" style={{ fontSize: 12.5, marginTop: 14 }}>
        Расчёт предварительный и зависит от расписания, оплат и оформленных абонементов. Итоговую сумму подтверждает администрация.
      </p>
    </>
  );
}
