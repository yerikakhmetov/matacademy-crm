import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isTeacher, getTeacherIdForUser } from "@/lib/teacher";
import { money, RATE_TYPE } from "@/lib/format";
import { computeSalary, subjectTeacherCounts } from "@/lib/payroll";
import { MonthSelect } from "../payroll/PayrollControls";

export const dynamic = "force-dynamic";

const MONTH_NAMES = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
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

  const [paidPayments, subjItems, records, subjTeachers] = await Promise.all([
    teacher.rateType === "PERCENT" && groupIds.length
      ? prisma.payment.findMany({ where: { status: "PAID", date: { gte: since }, student: { groups: { some: { id: { in: groupIds } } } } }, select: { amount: true, date: true, student: { select: { groups: { select: { id: true } } } } } })
      : Promise.resolve([] as { amount: number; date: Date; student: { groups: { id: string }[] } }[]),
    teacher.rateType === "PERCENT_SUBJECT" && subjectIds.length
      ? prisma.paymentItem.findMany({ where: { subjectId: { in: subjectIds }, payment: { status: "PAID", date: { gte: since } } }, select: { subjectId: true, amount: true, payment: { select: { date: true } } } })
      : Promise.resolve([] as { subjectId: string | null; amount: number; payment: { date: Date } }[]),
    prisma.payrollRecord.findMany({ where: { teacherId, year: { gte: since.getFullYear() } } }),
    teacher.rateType === "PERCENT_SUBJECT"
      ? prisma.teacher.findMany({ where: { rateType: "PERCENT_SUBJECT" }, select: { rateType: true, subjects: { select: { id: true } } } })
      : Promise.resolve([] as { rateType: string; subjects: { id: string }[] }[]),
  ]);

  const subjTeacherCount = subjectTeacherCounts(subjTeachers);
  const recMap = new Map(records.map((r) => [`${r.year}-${r.month}`, r]));
  const rt = RATE_TYPE[teacher.rateType] ?? RATE_TYPE.PER_LESSON;

  function monthData(m: { year: number; month0: number }) {
    const rec = recMap.get(`${m.year}-${m.month0}`);
    if (rec) {
      const baseLabel = rec.rateType === "PERCENT" || rec.rateType === "PERCENT_SUBJECT" ? money(rec.base) : rec.rateType === "PER_STUDENT" ? `${rec.base} учеников` : `${rec.base} уроков`;
      return { base: rec.base, baseLabel, salary: rec.salary, locked: true };
    }
    const revByGroup = new Map<string, number>();
    for (const p of paidPayments) {
      if (mKey(p.date) !== `${m.year}-${m.month0}`) continue;
      const gids = p.student.groups.map((g) => g.id);
      if (gids.length === 0) continue;
      const per = p.amount / gids.length;
      for (const gid of gids) revByGroup.set(gid, (revByGroup.get(gid) ?? 0) + per);
    }
    const revBySubject = new Map<string, number>();
    for (const it of subjItems) if (it.subjectId && mKey(it.payment.date) === `${m.year}-${m.month0}`) revBySubject.set(it.subjectId, (revBySubject.get(it.subjectId) ?? 0) + it.amount);
    const c = computeSalary(teacher!, { year: m.year, month0: m.month0, revByGroup, revBySubject, subjTeacherCount });
    return { ...c, locked: false };
  }

  const cur = monthData(sel);
  const history = monthOpts.map((m) => ({ name: m.name, salary: monthData(m).salary }));
  const histMax = Math.max(1, ...history.map((h) => h.salary));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Моя зарплата</h1>
          <p>Расчёт по вашей ставке за {sel.name}{cur.locked ? " · зафиксирован" : ""}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600 }}>К выплате за месяц</div>
          <div className="kval num" style={{ fontSize: 26, color: cur.salary > 0 ? "var(--ok)" : "var(--ink-3)" }}>{money(cur.salary)}</div>
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
        Расчёт предварительный, пока месяц не зафиксирован администрацией. Итоговую сумму подтверждает администрация.
      </p>
    </>
  );
}
