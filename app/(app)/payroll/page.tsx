import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData, requireAccess } from "@/lib/access";
import { isTeacher } from "@/lib/teacher";
import { getSettings } from "@/lib/settings";
import { money, initials, avatarColor } from "@/lib/format";
import { gatherCuratorPayroll, gatherPayroll } from "@/lib/payroll";
import { MonthSelect } from "./PayrollControls";
import { PayrollLockButton } from "./PayrollLockButton";

export const dynamic = "force-dynamic";

const MONTH_NAMES = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ month?: string; teacher?: string }> }) {
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

  const settings = await getSettings();
  const feePct = settings.schoolFeePct;

  const [teachers, records, live, curators, curatorLive, curatedGroups] = await Promise.all([
    prisma.teacher.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
    prisma.payrollRecord.findMany({ where: { year: sel.year, month: sel.month0 } }),
    gatherPayroll(sel.year, sel.month0, feePct),
    prisma.user.findMany({ where: { role: "CURATOR" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    gatherCuratorPayroll(sel.year, sel.month0, settings.curatorRate),
    prisma.group.findMany({ where: { curatorId: { not: null } }, select: { id: true, name: true } }),
  ]);
  const groupName = new Map(curatedGroups.map((g) => [g.id, g.name]));
  const locked = records.length > 0;
  // Детализация выбранного преподавателя: из чего сложилась сумма (только живой расчёт)
  const openTeacher = sp.teacher ? teachers.find((t) => t.id === sp.teacher) ?? null : null;
  const openDetails = openTeacher && !locked ? live.get(openTeacher.id)?.details ?? [] : [];
  const [detailStudents, detailGroups] = openDetails.length
    ? await Promise.all([
        prisma.student.findMany({ where: { id: { in: [...new Set(openDetails.map((d) => d.studentId))] } }, select: { id: true, name: true } }),
        prisma.group.findMany({ where: { id: { in: [...new Set(openDetails.map((d) => d.groupId))] } }, select: { id: true, name: true } }),
      ])
    : [[], []];
  const studentName = new Map(detailStudents.map((x) => [x.id, x.name]));
  const detailGroupName = new Map(detailGroups.map((x) => [x.id, x.name]));
  const detailRows = [...openDetails].sort(
    (a, b) => (detailGroupName.get(a.groupId) ?? "").localeCompare(detailGroupName.get(b.groupId) ?? "") || b.amount - a.amount
  );

  const curatorRows = curators.map((c) => ({ c, row: curatorLive.get(c.id) }));
  const curatorTotal = curatorRows.reduce((a, r) => a + (r.row?.salary ?? 0), 0);

  const recMap = new Map(records.map((r) => [r.teacherId, r]));

  const rows = teachers.map((t) => {
    const rec = locked ? recMap.get(t.id) : undefined;
    const src = rec ?? live.get(t.id);
    return {
      t,
      students: rec ? undefined : live.get(t.id)?.students ?? 0,
      lessons: rec ? undefined : live.get(t.id)?.paidLessons ?? 0,
      noFee: rec ? 0 : live.get(t.id)?.studentsWithoutFee ?? 0,
      base: src?.base ?? 0,
      salary: src?.salary ?? 0,
    };
  });

  const total = rows.reduce((a, r) => a + r.salary, 0) + curatorTotal;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Зарплата</h1>
          <p>{locked ? "Зафиксированный расчёт" : "Автоматический расчёт по посещаемости"} за {sel.name} · удержание школы {feePct}%</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600 }}>
            Фонд оплаты за месяц
          </div>
          <div className="kval num" style={{ fontSize: 26 }}>{money(total)}</div>
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
                <th className="right">Учеников</th>
                <th className="right">Оплач. занятий</th>
                <th className="right">Начислено</th>
                <th className="right">К выплате</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ t, students, lessons, noFee, base, salary }) => (
                <tr key={t.id}>
                  <td>
                    <div className="person">
                      <div className="av2" style={{ background: t.color || avatarColor(t.name), width: 30, height: 30, fontSize: 11 }}>
                        {initials(t.name)}
                      </div>
                      {locked ? (
                        <div className="nm" style={{ fontSize: 13.5 }}>{t.name}</div>
                      ) : (
                        <Link
                          className="nm"
                          href={`/payroll?month=${sel.id}${openTeacher?.id === t.id ? "" : `&teacher=${t.id}`}#details`}
                          style={{ fontSize: 13.5, color: "inherit", textDecoration: "underline dotted", textUnderlineOffset: 3 }}
                          title="Показать, из чего сложилась сумма"
                          aria-expanded={openTeacher?.id === t.id}
                        >
                          {t.name}
                        </Link>
                      )}
                    </div>
                  </td>
                  <td className="right mut num">
                    {students ?? "—"}
                    {noFee > 0 && (
                      <span className="chip c-bad" style={{ marginLeft: 6, padding: "1px 6px", fontSize: 10.5 }} title="Ходили на занятия, но месячная доля не найдена — за них ничего не начислено">
                        <span className="d" />{noFee} без оплаты
                      </span>
                    )}
                  </td>
                  <td className="right mut num">{lessons ?? "—"}</td>
                  <td className="right mut num">{money(base)}</td>
                  <td className="right money num" style={{ color: salary > 0 ? "var(--ok)" : "var(--ink-3)" }}>{money(salary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {openTeacher && !locked && (
        <div className="card" id="details" style={{ marginTop: 16 }}>
          <div className="card-h">
            <h3>{openTeacher.name} · из чего сложилась сумма</h3>
            <Link className="link" href={`/payroll?month=${sel.id}`}>Скрыть</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ученик</th>
                  <th>Группа</th>
                  <th className="right">Оплач. занятий</th>
                  <th className="right">К выплате</th>
                </tr>
              </thead>
              <tbody>
                {detailRows.length === 0 && (
                  <tr><td colSpan={4}><div className="empty">В этом месяце оплачиваемых посещений нет</div></td></tr>
                )}
                {detailRows.map((d) => (
                  <tr key={`${d.groupId}|${d.studentId}`}>
                    <td style={{ fontWeight: 600 }}>{studentName.get(d.studentId) ?? "—"}</td>
                    <td className="mut">{detailGroupName.get(d.groupId) ?? "—"}</td>
                    <td className="right num">{d.lessons}</td>
                    <td className="right num">
                      {d.noFee ? <span className="chip c-bad"><span className="d" />нет оплаты</span> : money(Math.round(d.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {curators.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-h">
            <h3>Кураторы</h3>
            <span className="mut" style={{ fontSize: 12.5 }}>{money(curatorTotal)} · общая ставка {money(settings.curatorRate)} с ученика</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Куратор</th>
                  <th className="right">Учеников</th>
                  <th className="right">Оплач. мест</th>
                  <th>По группам</th>
                  <th className="right">К выплате</th>
                </tr>
              </thead>
              <tbody>
                {curatorRows.map(({ c, row }) => (
                  <tr key={c.id}>
                    <td>
                      <div className="person">
                        <div className="av2" style={{ background: avatarColor(c.name ?? ""), width: 30, height: 30, fontSize: 11 }}>
                          {initials(c.name ?? "?")}
                        </div>
                        <div className="nm" style={{ fontSize: 13.5 }}>{c.name}</div>
                      </div>
                    </td>
                    <td className="right mut num">{row?.students ?? 0}</td>
                    <td className="right mut num">{row?.seats ?? 0}</td>
                    <td className="mut" style={{ fontSize: 12.5 }}>
                      {row && row.byGroup.length > 0
                        ? row.byGroup.map((b) => `${groupName.get(b.groupId) ?? "—"}: ${b.seats} уч. · ${money(b.amount)}`).join(" · ")
                        : "—"}
                    </td>
                    <td className="right money num" style={{ color: (row?.salary ?? 0) > 0 ? "var(--ok)" : "var(--ink-3)" }}>{money(row?.salary ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mut" style={{ fontSize: 12.5, marginTop: 14 }}>
        Куратор получает по каждой своей группе: ставка группы × ученики группы, оплатившие месяц
        (по оплаченным счетам). Две группы математики — два отдельных начисления. Ставка задаётся в карточке
        группы; если там пусто — ставка предмета, затем общая из настроек. Если ученик в этом месяце ходил
        в несколько групп одного предмета, ставка делится по числу занятий в каждой.
        Удержание школы на неё не влияет.
        Расчёт кураторов всегда живой — «Зафиксировать месяц» относится к преподавателям.
      </p>

      <p className="mut" style={{ fontSize: 12.5, marginTop: 14 }}>
        Если у предмета задана ставка преподавателя (например 8000 ₸ с ученика за 12 занятий), зарплата = цена
        одного занятия (ставка ÷ число занятий) × число оплачиваемых посещений каждого ученика. Удержание школы
        к ставке не применяется, оплата ученика на неё не влияет. Если ставка не задана:
        зарплата = месячная доля ученика по предмету − {feePct}% (доход школы), делённая на число занятий
        группы в этом месяце по расписанию. Начисляется за каждое оплачиваемое посещение — был или отсутствовал
        без уважительной причины; за пропуск по уважительной причине за этого ученика в этот день не платят.
        За месяц с ученика не начисляется больше его месячной доли.
        Отменённое занятие из расчёта выпадает — кроме сорванных по вине преподавателя: такой день
        остаётся в делителе, и за него не начисляется.
        Метка «без оплаты» — ученик ходил, но оплаченного счёта за этот месяц по этому предмету нет. Счёт на несколько месяцев делится между ними поровну; если ученик ходил в несколько групп предмета, доля делится по занятиям в каждой.
        «Зафиксировать месяц» сохраняет расчёт как есть — прошлые месяцы не меняются задним числом.
      </p>
    </>
  );
}
