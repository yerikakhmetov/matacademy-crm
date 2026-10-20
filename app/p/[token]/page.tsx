import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import {
  money,
  initials,
  avatarColor,
  formatDate,
  scoreColor,
  gradeChipClass,
  PAYMENT_STATUS,
} from "@/lib/format";
import { Icon } from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { BarChart } from "@/components/BarChart";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { getLocale } from "@/lib/locale";
import { dayShort, gradeTypeLabel, t } from "@/lib/i18n";
import { GradeMonthSummary } from "@/components/GradeMonthSummary";
import { loadGroupRating } from "@/components/GroupRating";
import { lessonsLeftBySubject } from "@/lib/payroll";
import { BrandMark } from "@/components/BrandMark";
import { ZachetList } from "@/components/ZachetList";
import { cardCols } from "@/lib/card-table";

export const dynamic = "force-dynamic";

export default async function ParentPortal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const student = await prisma.student.findUnique({
    where: { portalToken: token },
    include: {
      groups: { include: { teacher: true, lessons: { where: { archivedAt: null } }, subject: { select: { id: true, name: true } } } },
      grades: {
        orderBy: { date: "desc" },
        take: 12,
        // Қай пәнге қойылғаны: баға топқа байланған, топтың пәні бар
        include: { group: { select: { name: true, subject: { select: { name: true } } } } },
      },
      payments: { orderBy: { date: "desc" }, take: 8 },
    },
  });
  if (!student) notFound();
  const settings = await getSettings();
  const locale = await getLocale();
  // место в каждой группе за текущий месяц (тот же рейтинг, что в кабинете ученика)
  const placeRows = (
    await Promise.all(
      student.groups.map(async (g) => {
        const { rows } = await loadGroupRating(g.id, settings.tzOffsetHours);
        const me = rows.find((r) => r.studentId === student.id);
        return me && rows.length > 1 ? { groupId: g.id, groupName: g.name, place: me.place, of: rows.length, points: me.points } : null;
      }),
    )
  ).filter((r): r is NonNullable<typeof r> => r !== null);

  const groupIds = student.groups.map((g) => g.id);

  // Зачёты групп ученика с его отметкой: 15 последних (предстоящие и прошедшие)
  const zachetRows = groupIds.length
    ? (
        await prisma.zachet.findMany({
          where: { groupId: { in: groupIds } },
          orderBy: { scheduledAt: "desc" },
          take: 15,
          include: { group: { select: { name: true } }, results: { where: { studentId: student.id }, select: { passed: true } } },
        })
      ).map((z) => ({ id: z.id, topic: z.topic, scheduledAt: z.scheduledAt, groupName: z.group.name, result: z.results[0] ?? null }))
    : [];

  const homeworks = groupIds.length
    ? await prisma.homework.findMany({
        where: { groupId: { in: groupIds } },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { completions: { where: { studentId: student.id } } },
      })
    : [];

  const materials = await prisma.material.findMany({
    where: { OR: [{ groupId: null }, ...(groupIds.length ? [{ groupId: { in: groupIds } }] : [])] },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const avg =
    student.grades.length > 0
      ? Math.round(student.grades.reduce((a, g) => a + (g.score / g.maxScore) * 100, 0) / student.grades.length)
      : null;
  // Пәндер — оқушы жүрген топтардың пәндері. Төлем — сабақ пакеттері: әр пән бойынша
  // қанша төленген сабақ қалды (lib/packages.ts)
  const subjects = [...new Map(student.groups.filter((g) => g.subject).map((g) => [g.subject!.id, g.subject!])).values()];
  const subjectNames = subjects.map((s) => s.name);
  const leftBySubject = await Promise.all(
    subjects.map(async (s) => ({ name: s.name, info: (await lessonsLeftBySubject([student.id], s.id)).get(student.id) }))
  );
  const anyPaid = leftBySubject.some((x) => (x.info?.total ?? 0) > 0);
  const lessons = student.groups
    .flatMap((g) => g.lessons.map((l) => ({ ...l, groupName: g.subject?.name ? `${g.subject.name} · ${g.name}` : g.name })))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));

  return (
    <div style={{ minHeight: "100vh", background: "var(--ground)", padding: "24px 16px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Шкала школы: логотип, название, язык — отдельной строкой, чтобы не сжимать карточку ученика */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BrandMark size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, lineHeight: 1.15 }}>{settings.schoolName}</div>
            <div className="mut" style={{ fontSize: 11.5 }}>{t(locale, "portal.diary")}</div>
          </div>
          <LocaleSwitcher current={locale} path={`/p/${token}`} />
        </div>

        {/* Приветствие родителю */}
        {student.parentName && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px" }}>
            <Avatar name={student.parentName} photoUrl={student.parentPhotoUrl} size={36} radius={18} fontSize={13} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>{t(locale, "portal.helloParent", { name: student.parentName })}</span>
          </div>
        )}

        {/* Ученик: имя крупно, группы — списком «предмет · группа — преподаватель», а не одной строкой */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar name={student.name} photoUrl={student.photoUrl} size={56} radius={14} fontSize={19} />
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 21, lineHeight: 1.2 }}>{student.name}</h1>
              {student.grade && <p className="mut" style={{ fontSize: 13, margin: "2px 0 0" }}>{student.grade}</p>}
            </div>
          </div>
          {student.groups.length > 0 ? (
            <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "flex", flexDirection: "column", gap: 6 }}>
              {student.groups.map((g) => (
                <li key={g.id} style={{ fontSize: 13, lineHeight: 1.4 }}>
                  <b style={{ fontWeight: 600 }}>{g.subject?.name ? `${g.subject.name} · ${g.name}` : g.name}</b>
                  {g.teacher?.name && <span className="mut"> — {g.teacher.name}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mut" style={{ fontSize: 13, margin: "10px 0 0" }}>{t(locale, "common.noGroup")}</p>
          )}
        </div>

        {/* Показатели */}
        <div className="grid kpis portal-kpis">
          <div className="card kpi">
            <div className="klabel">
              <span className="kico" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>
                <Icon name="check" size={16} />
              </span>
              {t(locale, "cabinet.attendance")}
            </div>
            <div className="kval num" style={{ color: student.attendance == null ? "var(--ink-3)" : scoreColor(student.attendance) }}>{student.attendance == null ? "—" : `${student.attendance}%`}</div>
          </div>
          <div className="card kpi">
            <div className="klabel">
              <span className="kico" style={{ background: "var(--violet-soft)", color: "var(--violet)" }}>
                <Icon name="chart" size={16} />
              </span>
              {t(locale, "cabinet.avgScore")}
            </div>
            <div className="kval num" style={{ color: avg != null ? scoreColor(avg) : "var(--ink-3)" }}>
              {avg != null ? `${avg}%` : "—"}
            </div>
          </div>
          <div className="card kpi">
            <div className="klabel">
              <span className="kico" style={{ background: student.balance < 0 ? "var(--bad-soft)" : "var(--ok-soft)", color: student.balance < 0 ? "var(--bad)" : "var(--ok)" }}>
                <Icon name="money" size={16} />
              </span>
              {t(locale, "portal.balance")}
            </div>
            <div className="kval num" style={{ fontSize: 22, color: student.balance < 0 ? "var(--bad)" : "var(--ok)" }}>
              {student.balance < 0 ? money(student.balance) : t(locale, "portal.noDebt")}
            </div>
          </div>
        </div>

        {/* Абонемент + расписание */}
        <div className="two-col">
          <div className="card">
            <div className="card-h"><h3>{t(locale, "cabinet.schedule")}</h3></div>
            <div style={{ padding: "6px 0" }}>
              {lessons.length === 0 && <div className="empty">{t(locale, "cabinet.noSchedule")}</div>}
              {lessons.map((l) => (
                <div className="list-row" key={l.id}>
                  <div style={{ width: 40, fontWeight: 700 }}>{dayShort(locale, l.dayOfWeek)}</div>
                  <div className="num" style={{ width: 54, fontWeight: 600 }}>{l.startTime}</div>
                  <div style={{ flex: 1 }} className="mut">{l.groupName} · {l.room}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-h">
              <h3>{t(locale, "portal.subjects")}</h3>
              {subjectNames.length > 0 && (
                <span className="chip c-mut">
                  <span className="d" />
                  {t(locale, "portal.subjectsCount", { n: String(subjectNames.length) })}
                </span>
              )}
            </div>
            <div style={{ padding: 18 }}>
              <dl className="dl">
                <dt>{t(locale, "portal.subjects")}</dt>
                <dd>{subjectNames.length > 0 ? subjectNames.join(", ") : "—"}</dd>
                <dt>{t(locale, "portal.lessonsLeft")}</dt>
                <dd>
                  {anyPaid
                    ? leftBySubject.map((x) => `${x.name}: ${Math.max(0, x.info?.left ?? 0)} ${t(locale, "portal.lessonsUnit")}`).join(", ")
                    : t(locale, "portal.notPaidYet")}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        {/* Зачёты: тема, когда, сдал / не сдал */}
        <div className="card">
          <div className="card-h">
            <h3>{t(locale, "zachet.title")}</h3>
            <span className="chip c-mut"><span className="d" />{zachetRows.length}</span>
          </div>
          <div style={{ padding: "6px 0" }}>
            <ZachetList rows={zachetRows} tz={settings.tzOffsetHours} locale={locale} />
          </div>
        </div>

        {/* Домашние задания */}
        <div className="card">
          <div className="card-h">
            <h3>{t(locale, "hw.title")}</h3>
            <span className="chip c-mut"><span className="d" />{homeworks.length}</span>
          </div>
          <div style={{ padding: "6px 0" }}>
            {homeworks.length === 0 && <div className="empty">{t(locale, "hw.empty")}</div>}
            {homeworks.map((hw) => {
              const done = hw.completions[0]?.done ?? false;
              const overdue = hw.dueDate && new Date(hw.dueDate) < new Date() && !done;
              return (
                <div className="list-row" key={hw.id}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{hw.title}</div>
                    {hw.description && <div className="mut" style={{ fontSize: 12 }}>{hw.description}</div>}
                    {hw.dueDate && (
                      <div className="mut" style={{ fontSize: 11.5, color: overdue ? "var(--bad)" : undefined }}>
                        {t(locale, "hw.due", { date: formatDate(hw.dueDate) })}
                      </div>
                    )}
                  </div>
                  <span className={`chip ${done ? "c-ok" : "c-mut"}`}>
                    <span className="d" />
                    {done ? t(locale, "hw.done") : t(locale, "portal.hwNotDone")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Динамика оценок */}
        {student.grades.length >= 2 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-h">
              <h3>{t(locale, "cabinet.howAreThings")}</h3>
              <span className="chip c-mut"><span className="d" />{t(locale, "cabinet.lastN", { n: student.grades.length })}</span>
            </div>
            <div style={{ padding: 18 }}>
              <BarChart
                data={[...student.grades]
                  .reverse()
                  .map((g) => ({
                    label: `${new Date(g.date).getUTCDate()}.${new Date(g.date).getUTCMonth() + 1}`,
                    value: Math.round((g.score / g.maxScore) * 100),
                  }))}
                color="var(--violet)"
                height={150}
                formatValue={(n) => `${n}%`}
              />
              <p className="mut" style={{ fontSize: 12, margin: "10px 0 0" }}>
                {t(locale, "cabinet.progressNote")}
              </p>
            </div>
          </div>
        )}

        {/* Рейтинг ребёнка в его группах: только место и очки, без чужих имён */}
        {placeRows.length > 0 && (
          <div className="card">
            <div className="card-h">
              <h3>{t(locale, "rating.parentTitle")}</h3>
            </div>
            <div style={{ padding: "6px 0" }}>
              {placeRows.map((r) => (
                <div key={r.groupId} className="list-row" style={{ alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{r.groupName}</div>
                  <span style={{ fontWeight: 700 }}>{t(locale, "rating.place", { n: r.place })}</span>
                  <span className="mut">/ {r.of} · {t(locale, "rating.points", { n: r.points })}</span>
                </div>
              ))}
            </div>
            <p className="mut" style={{ fontSize: 12, margin: 0, padding: "0 18px 14px" }}>{t(locale, "rating.parentNote")}</p>
          </div>
        )}

        {/* Оценки */}
        <div className="card">
          <div className="card-h">
            <h3>{t(locale, "cabinet.grades")}</h3>
            <span className="chip c-mut"><span className="d" />{student.grades.length}</span>
          </div>
          <GradeMonthSummary studentId={student.id} tz={settings.tzOffsetHours} locale={locale} />
          <div className="table-wrap">
            <table {...cardCols([t(locale, "portal.forWhat"), t(locale, "portal.type"), t(locale, "portal.date"), t(locale, "portal.grade")])}>
              <thead>
                <tr>
                  <th>{t(locale, "portal.forWhat")}</th>
                  <th>{t(locale, "portal.type")}</th>
                  <th>{t(locale, "portal.date")}</th>
                  <th className="right">{t(locale, "portal.grade")}</th>
                </tr>
              </thead>
              <tbody>
                {student.grades.length === 0 && (
                  <tr><td colSpan={4}><div className="empty">{t(locale, "cabinet.noGrades")}</div></td></tr>
                )}
                {student.grades.map((g) => {
                  const pct = Math.round((g.score / g.maxScore) * 100);
                  return (
                    <tr key={g.id}>
                      <td style={{ fontWeight: 600 }}>
                        {g.topic}
                        {(g.group?.subject?.name || g.group?.name) && (
                          <div className="mut" style={{ fontSize: 11.5, fontWeight: 400 }}>
                            {g.group?.subject?.name ?? g.group?.name}
                          </div>
                        )}
                      </td>
                      <td className="mut">{gradeTypeLabel(locale, g.type)}</td>
                      <td className="mut">{formatDate(g.date)}</td>
                      <td className="right">
                        <span className={`chip ${gradeChipClass(pct)}`}><span className="d" />{g.score}/{g.maxScore}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Материалы */}
        {materials.length > 0 && (
          <div className="card">
            <div className="card-h">
              <h3>{t(locale, "cabinet.materials")}</h3>
              <span className="chip c-mut"><span className="d" />{materials.length}</span>
            </div>
            <div style={{ padding: "6px 0" }}>
              {materials.map((m) => (
                <a key={m.id} href={m.fileUrl} target="_blank" rel="noopener noreferrer" className="list-row" style={{ textDecoration: "none" }}>
                  <div className="pay-ico" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                    <Icon name="export" size={16} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{m.title}</div>
                    <div className="mut" style={{ fontSize: 12 }}>{m.fileName}</div>
                  </div>
                  <span className="mut" style={{ fontSize: 12 }}>{formatDate(m.createdAt)}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Оплаты */}
        <div className="card">
          <div className="card-h">
            <h3>{t(locale, "portal.payments")}</h3>
          </div>
          <div className="table-wrap">
            <table {...cardCols([t(locale, "portal.purpose"), t(locale, "portal.date"), t(locale, "portal.status"), t(locale, "portal.sum")])}>
              <thead>
                <tr>
                  <th>{t(locale, "portal.purpose")}</th>
                  <th>{t(locale, "portal.date")}</th>
                  <th>{t(locale, "portal.status")}</th>
                  <th className="right">{t(locale, "portal.sum")}</th>
                </tr>
              </thead>
              <tbody>
                {student.payments.length === 0 && (
                  <tr><td colSpan={4}><div className="empty">{t(locale, "portal.noPayments")}</div></td></tr>
                )}
                {student.payments.map((p) => {
                  const psx = PAYMENT_STATUS[p.status] ?? PAYMENT_STATUS.PAID;
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.purpose}</td>
                      <td className="mut">{formatDate(p.date)}</td>
                      <td><span className={`chip ${psx.cls}`}><span className="d" />{psx.label}</span></td>
                      <td className="right money num" style={{ color: p.status === "PAID" ? "var(--ok)" : p.status === "OVERDUE" ? "var(--bad)" : "var(--ink)" }}>{money(p.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--ink-3)", margin: "4px 0 16px" }}>
          {settings.schoolName} · {t(locale, "portal.autoUpdate")}
        </p>
      </div>
    </div>
  );
}
