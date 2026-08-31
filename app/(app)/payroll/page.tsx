import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData, requireAccess } from "@/lib/access";
import { isTeacher } from "@/lib/teacher";
import { money, initials, avatarColor, RATE_TYPE } from "@/lib/format";
import { ModalButton } from "@/components/ModalButton";
import { MonthSelect } from "./PayrollControls";
import { RateForm } from "./RateForm";
import { updateTeacherRate } from "@/app/actions/data";

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

  const [teachers, paidPayments, subjItems] = await Promise.all([
    prisma.teacher.findMany({
      include: {
        groups: { include: { _count: { select: { students: true } }, lessons: true } },
        subjects: { select: { id: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.payment.findMany({
      where: { status: "PAID", date: { gte: monthStart, lt: monthEnd } },
      include: { student: { select: { groupId: true } } },
    }),
    // доли предметов по абонементам, начатым в этом месяце (для PERCENT_SUBJECT)
    prisma.subscriptionItem.findMany({
      where: { subscription: { startDate: { gte: monthStart, lt: monthEnd } } },
      select: { subjectId: true, amount: true },
    }),
  ]);

  // Доход по группам за месяц (для типа PERCENT)
  const revenueByGroup = new Map<string, number>();
  for (const p of paidPayments) {
    const gid = p.student.groupId;
    if (gid) revenueByGroup.set(gid, (revenueByGroup.get(gid) ?? 0) + p.amount);
  }

  // Доход по предметам за месяц (для типа PERCENT_SUBJECT)
  const revenueBySubject = new Map<string, number>();
  for (const it of subjItems) {
    if (it.subjectId) revenueBySubject.set(it.subjectId, (revenueBySubject.get(it.subjectId) ?? 0) + it.amount);
  }

  const rows = teachers.map((t) => {
    let base = 0;
    let baseLabel = "";
    let salary = 0;
    if (t.rateType === "PER_STUDENT") {
      base = t.groups.reduce((a, g) => a + g._count.students, 0);
      baseLabel = `${base} учеников`;
      salary = base * t.rate;
    } else if (t.rateType === "PERCENT") {
      base = t.groups.reduce((a, g) => a + (revenueByGroup.get(g.id) ?? 0), 0);
      baseLabel = money(base);
      salary = Math.round((base * t.rate) / 100);
    } else if (t.rateType === "PERCENT_SUBJECT") {
      base = t.subjects.reduce((a, s) => a + (revenueBySubject.get(s.id) ?? 0), 0);
      baseLabel = t.subjects.length ? money(base) : "нет предметов";
      salary = Math.round((base * t.rate) / 100);
    } else {
      // PER_LESSON — количество проведённых по расписанию уроков в месяце
      base = t.groups.reduce((a, g) => a + g.lessons.reduce((la, l) => la + datesInMonth(sel.year, sel.month0, l.dayOfWeek), 0), 0);
      baseLabel = `${base} уроков`;
      salary = base * t.rate;
    }
    return { t, base, baseLabel, salary };
  });

  const total = rows.reduce((a, r) => a + r.salary, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Зарплата преподавателей</h1>
          <p>Автоматический расчёт за {sel.name}</p>
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
        <span className="proto-note">Расчёт по ставке каждого преподавателя</span>
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
                {editor && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ t, baseLabel, salary }) => {
                const rt = RATE_TYPE[t.rateType] ?? RATE_TYPE.PER_LESSON;
                return (
                  <tr key={t.id}>
                    <td>
                      <div className="person">
                        <div className="av2" style={{ background: t.color || avatarColor(t.name), width: 30, height: 30, fontSize: 11 }}>
                          {initials(t.name)}
                        </div>
                        <div className="nm" style={{ fontSize: 13.5 }}>
                          {t.name}
                        </div>
                      </div>
                    </td>
                    <td className="mut">{rt.label}</td>
                    <td className="right num">
                      {t.rate ? (t.rateType === "PERCENT" || t.rateType === "PERCENT_SUBJECT" ? `${t.rate}%` : money(t.rate)) : <span className="mut">не задана</span>}
                    </td>
                    <td className="right mut num">{baseLabel}</td>
                    <td className="right money num" style={{ color: salary > 0 ? "var(--ok)" : "var(--ink-3)" }}>
                      {money(salary)}
                    </td>
                    {editor && (
                      <td className="right">
                        <ModalButton
                          label="Ставка"
                          title={`Ставка · ${t.name}`}
                          icon="edit"
                          buttonClass="btn ghost"
                          action={updateTeacherRate.bind(null, t.id)}
                          submitLabel="Сохранить"
                        >
                          <RateForm rate={t.rate} rateType={t.rateType} />
                        </ModalButton>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mut" style={{ fontSize: 12.5, marginTop: 14 }}>
        «За урок» — по числу занятий в расписании за месяц · «За ученика» — по числу учеников в группах · «% от оплат» — процент от оплаченного его учениками за месяц · «% от дохода по предметам» — процент от доли его предметов в абонементах, оформленных за месяц.
      </p>
    </>
  );
}
