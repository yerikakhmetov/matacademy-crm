import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isTeacher, getTeacherIdForUser } from "@/lib/teacher";
import { getSettings } from "@/lib/settings";
import { money } from "@/lib/format";
import { gatherPayrollRange } from "@/lib/payroll";
import { MonthSelect } from "../payroll/PayrollControls";

export const dynamic = "force-dynamic";

const MONTH_NAMES = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

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
            <p>Расчёт вознаграждения по посещаемости</p>
          </div>
        </div>
        <div className="card">
          <div className="empty">Профиль преподавателя не привязан к аккаунту. Обратитесь к администратору.</div>
        </div>
      </>
    );
  }

  const settings = await getSettings();
  const feePct = settings.schoolFeePct;

  const records = await prisma.payrollRecord.findMany({ where: { teacherId, year: { gte: monthOpts[monthOpts.length - 1].year } } });
  const recMap = new Map(records.map((r) => [`${r.year}-${r.month}`, r]));

  // Живой расчёт по всем 6 месяцам одним набором запросов (для незафиксированных)
  const live = await gatherPayrollRange(monthOpts, feePct);

  const monthData = monthOpts.map((m, i) => {
    const rec = recMap.get(`${m.year}-${m.month0}`);
    if (rec) return { name: m.name, id: m.id, base: rec.base, salary: rec.salary, students: null as number | null, lessons: null as number | null, noFee: 0, locked: true };
    const r = live[i].get(teacherId);
    return { name: m.name, id: m.id, base: r?.base ?? 0, salary: r?.salary ?? 0, students: r?.students ?? 0, lessons: r?.paidLessons ?? 0, noFee: r?.studentsWithoutFee ?? 0, locked: false };
  });

  const cur = monthData.find((m) => m.id === sel.id) ?? monthData[0];
  const histMax = Math.max(1, ...monthData.map((h) => h.salary));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Моя зарплата</h1>
          <p>Расчёт по посещаемости за {sel.name}{cur.locked ? " · зафиксирован" : ""}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600 }}>К выплате за месяц</div>
          <div className="kval num" style={{ fontSize: 26, color: cur.salary > 0 ? "var(--ok)" : "var(--ink-3)" }}>{money(cur.salary)}</div>
        </div>
      </div>

      <div className="toolbar">
        <MonthSelect months={monthOpts} month={sel.id} path="/my-salary" />
        <span className="proto-note">Удержание школы {feePct}%</span>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-h"><h3>Как рассчитано</h3></div>
          <div style={{ padding: 18 }}>
            <dl className="dl">
              <dt>Оплачиваемых посещений</dt>
              <dd>{cur.lessons == null ? "—" : cur.lessons}</dd>
              <dt>Учеников с оплатой</dt>
              <dd>{cur.students == null ? "—" : cur.students}</dd>
              <dt>Начислено</dt>
              <dd>{money(cur.base)}</dd>
              <dt>Удержание школы</dt>
              <dd>−{feePct}%</dd>
              {cur.noFee > 0 && (
                <>
                  <dt>Без оплаты</dt>
                  <dd style={{ color: "var(--bad)" }}>{cur.noFee} уч. — ходили, но оплата за месяц не найдена</dd>
                </>
              )}
              <dt>К выплате</dt>
              <dd style={{ fontWeight: 800, color: "var(--ok)" }}>{money(cur.salary)}</dd>
            </dl>
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Последние 6 месяцев</h3></div>
          <div className="funnel" style={{ padding: 14 }}>
            {monthData.map((h) => (
              <div className="frow" key={h.id}>
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
        Оплачивается каждое посещение — были или отсутствовали без уважительной причины; пропуск по уважительной
        причине не оплачивается. Цена одного занятия = месячная доля ученика ÷ число занятий группы в этом месяце по расписанию.
        Расчёт предварительный, пока месяц не зафиксирован администрацией.
      </p>
    </>
  );
}
