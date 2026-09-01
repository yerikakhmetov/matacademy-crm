import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData, requireAccess } from "@/lib/access";
import { isTeacher } from "@/lib/teacher";
import { money, initials, avatarColor, RATE_TYPE } from "@/lib/format";
import { computeSalary, subjectTeacherCounts } from "@/lib/payroll";
import { ModalButton } from "@/components/ModalButton";
import { MonthSelect } from "./PayrollControls";
import { RateForm } from "./RateForm";
import { PayrollLockButton } from "./PayrollLockButton";
import { updateTeacherRate } from "@/app/actions/data";

export const dynamic = "force-dynamic";

const MONTH_NAMES = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  if (isTeacher(session?.user?.role)) redirect("/dashboard");
  await requireAccess("payroll");
  const editor = await canEditData(session?.user?.role);

  const now = new Date();
  const monthOpts = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { id: `${d.getFullYear()}-${d.getMonth()}`, name: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`, year: d.getFullYear(), month0: d.getMonth() };
  });
  const sel = (sp.month && monthOpts.find((m) => m.id === sp.month)) || monthOpts[0];

  const monthStart = new Date(sel.year, sel.month0, 1);
  const monthEnd = new Date(sel.year, sel.month0 + 1, 1);

  const [teachers, paidPayments, payItems, records] = await Promise.all([
    prisma.teacher.findMany({
      include: {
        groups: { include: { _count: { select: { students: true } }, lessons: { select: { dayOfWeek: true } } } },
        subjects: { select: { id: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.payment.findMany({ where: { status: "PAID", date: { gte: monthStart, lt: monthEnd } }, select: { amount: true, student: { select: { groups: { select: { id: true } } } } } }),
    prisma.paymentItem.findMany({ where: { payment: { status: "PAID", date: { gte: monthStart, lt: monthEnd } } }, select: { subjectId: true, amount: true } }),
    prisma.payrollRecord.findMany({ where: { year: sel.year, month: sel.month0 } }),
  ]);

  const revByGroup = new Map<string, number>();
  for (const p of paidPayments) {
    const gids = p.student.groups.map((g) => g.id);
    if (gids.length === 0) continue;
    const per = p.amount / gids.length;
    for (const gid of gids) revByGroup.set(gid, (revByGroup.get(gid) ?? 0) + per);
  }
  const revBySubject = new Map<string, number>();
  for (const it of payItems) if (it.subjectId) revBySubject.set(it.subjectId, (revBySubject.get(it.subjectId) ?? 0) + it.amount);
  const subjTeacherCount = subjectTeacherCounts(teachers);
  const ctx = { year: sel.year, month0: sel.month0, revByGroup, revBySubject, subjTeacherCount };

  const locked = records.length > 0;
  const recMap = new Map(records.map((r) => [r.teacherId, r]));

  const rows = teachers.map((t) => {
    const rec = locked ? recMap.get(t.id) : undefined;
    if (rec) {
      const rt = RATE_TYPE[rec.rateType] ?? RATE_TYPE.PER_LESSON;
      const baseLabel = rec.rateType === "PERCENT" || rec.rateType === "PERCENT_SUBJECT" ? money(rec.base) : rec.rateType === "PER_STUDENT" ? `${rec.base} учеников` : `${rec.base} уроков`;
      return { t, rt, rate: rec.rate, rateType: rec.rateType, baseLabel, salary: rec.salary };
    }
    const c = computeSalary(t, ctx);
    return { t, rt: RATE_TYPE[t.rateType] ?? RATE_TYPE.PER_LESSON, rate: t.rate, rateType: t.rateType, baseLabel: c.baseLabel, salary: c.salary };
  });

  const total = rows.reduce((a, r) => a + r.salary, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Зарплата преподавателей</h1>
          <p>{locked ? "Зафиксированный расчёт" : "Автоматический расчёт"} за {sel.name}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600 }}>
            Фонд оплаты за месяц
          </div>
          <div className="kval num" style={{ fontSize: 26 }}>
            {money(total)}
          </div>
        </div>
      </div>

      <div className="toolbar">
        <MonthSelect months={monthOpts} month={sel.id} />
        <div className="spacer" />
        {editor && <PayrollLockButton year={sel.year} month0={sel.month0} locked={locked} />}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Преподаватель</th>
                <th>Тип оплаты</th>
                <th className="right">Ставка</th>
                <th className="right">База за месяц</th>
                <th className="right">К выплате</th>
                {editor && !locked && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ t, rt, rate, rateType, baseLabel, salary }) => (
                <tr key={t.id}>
                  <td>
                    <div className="person">
                      <div className="av2" style={{ background: t.color || avatarColor(t.name), width: 30, height: 30, fontSize: 11 }}>
                        {initials(t.name)}
                      </div>
                      <div className="nm" style={{ fontSize: 13.5 }}>{t.name}</div>
                    </div>
                  </td>
                  <td className="mut">{rt.label}</td>
                  <td className="right num">
                    {rate ? (rateType === "PERCENT" || rateType === "PERCENT_SUBJECT" ? `${rate}%` : money(rate)) : <span className="mut">не задана</span>}
                  </td>
                  <td className="right mut num">{baseLabel}</td>
                  <td className="right money num" style={{ color: salary > 0 ? "var(--ok)" : "var(--ink-3)" }}>
                    {money(salary)}
                  </td>
                  {editor && !locked && (
                    <td className="right">
                      <ModalButton label="Ставка" title={`Ставка · ${t.name}`} icon="edit" buttonClass="btn ghost" action={updateTeacherRate.bind(null, t.id)} submitLabel="Сохранить">
                        <RateForm rate={t.rate} rateType={t.rateType} />
                      </ModalButton>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mut" style={{ fontSize: 12.5, marginTop: 14 }}>
        «За урок» — по числу занятий в расписании · «За ученика» — по числу учеников · «% от оплат» — процент от оплат его учеников · «% от дохода по предметам» — процент от собранных по его предметам оплат за месяц (доход предмета делится между его преподавателями; предметы отмечаются при приёме оплаты). «Зафиксировать месяц» сохраняет расчёт как есть — прошлые месяцы не меняются при смене ставок или состава.
      </p>
    </>
  );
}
