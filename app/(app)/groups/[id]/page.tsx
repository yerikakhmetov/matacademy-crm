import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getAccess } from "@/lib/access";
import { getTeacherIdForUser, isTeacher } from "@/lib/teacher";
import { isCurator } from "@/lib/curator";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { DAYS, STUDENT_STATUS, formatDate, money } from "@/lib/format";

export const dynamic = "force-dynamic";

// Ссылка «позвонить»: пробелы и скобки в tel: только мешают набору
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

export default async function GroupDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const { can } = await getAccess();
  const uid = session?.user?.id;

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      teacher: { select: { id: true, name: true, phone: true, userId: true } },
      subject: { select: { name: true, color: true } },
      curator: { select: { id: true, name: true } },
      lessons: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      students: {
        orderBy: { name: "asc" },
        select: {
          id: true, name: true, phone: true, grade: true, status: true,
          parentName: true, parentPhone: true, attendance: true, balance: true, photoUrl: true,
        },
      },
    },
  });
  if (!group) notFound();

  // Преподаватель видит только свои группы, куратор — только закреплённые:
  // иначе по прямой ссылке открылся бы состав и телефоны чужой группы.
  if (isTeacher(session?.user?.role)) {
    const myTeacherId = await getTeacherIdForUser(uid);
    if (!myTeacherId || group.teacherId !== myTeacherId) redirect("/groups");
  }
  if (isCurator(session?.user?.role) && group.curatorId !== uid) redirect("/groups");

  const showMoney = can("finance");
  const enrolled = group.students.length;
  const pct = Math.min(100, Math.round((enrolled / group.capacity) * 100));
  const debtors = group.students.filter((s) => s.balance < 0);

  const sameTime = group.lessons.length > 0 && group.lessons.every((l) => l.startTime === group.lessons[0].startTime);
  const scheduleText = group.lessons.length === 0
    ? "расписание не задано"
    : sameTime
      ? `${group.lessons.map((l) => DAYS[l.dayOfWeek]).join(" · ")} · ${group.lessons[0].startTime}`
      : group.lessons.map((l) => `${DAYS[l.dayOfWeek]} ${l.startTime}`).join(" · ");

  return (
    <>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/groups" className="close-x" style={{ textDecoration: "none" }}>←</Link>
          <div className="gtag" style={{ background: group.color, width: 48, height: 48, borderRadius: 12, fontSize: 18 }}>
            {group.name[0]}
          </div>
          <div>
            <h1 style={{ fontSize: 22, display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              {group.name}
              {group.subject && (
                <span className="chip" style={{ padding: "2px 9px", fontSize: 11, background: `${group.subject.color}22`, color: group.subject.color }}>
                  {group.subject.name}
                </span>
              )}
            </h1>
            <p>
              {group.level ? `${group.level} · ` : ""}{scheduleText}
              {group.startDate && group.startDate.getTime() > Date.now() ? ` · старт ${formatDate(group.startDate)}` : ""}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn ghost" href={`/journal?group=${group.id}`}>
            <Icon name="check" size={15} />
            Журнал
          </Link>
          <Link className="btn ghost" href="/schedule">
            <Icon name="schedule" size={15} />
            Расписание
          </Link>
        </div>
      </div>

      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <div className="card kpi">
          <div className="klabel">
            <span className="kico" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><Icon name="students" size={16} /></span>
            Учеников
          </div>
          <div className="kval num">{enrolled}/{group.capacity}</div>
          <div className="ktrend">{pct}% мест занято</div>
        </div>
        <div className="card kpi">
          <div className="klabel">
            <span className="kico" style={{ background: "var(--violet-soft, var(--accent-soft))", color: "var(--violet, var(--accent))" }}><Icon name="teachers" size={16} /></span>
            Преподаватель
          </div>
          <div className="kval" style={{ fontSize: 17 }}>{group.teacher?.name ?? "—"}</div>
          {group.teacher?.phone && (
            <div className="ktrend"><a href={telHref(group.teacher.phone)} style={{ color: "inherit" }}>{group.teacher.phone}</a></div>
          )}
        </div>
        <div className="card kpi">
          <div className="klabel">
            <span className="kico" style={{ background: "var(--warn-soft)", color: "var(--amber)" }}><Icon name="pin" size={16} /></span>
            Куратор
          </div>
          <div className="kval" style={{ fontSize: 17 }}>{group.curator?.name ?? "не назначен"}</div>
        </div>
        {showMoney && (
          <div className="card kpi">
            <div className="klabel">
              <span className="kico" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}><Icon name="alert" size={16} /></span>
              Должники
            </div>
            <div className="kval num">{debtors.length}</div>
            <div className="ktrend">{money(debtors.reduce((a, s) => a + s.balance, 0))}</div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-h">
          <h3>Ученики группы</h3>
          <span className="chip c-mut"><span className="d" />{enrolled}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ученик</th>
                <th>Телефон ученика</th>
                <th>Родитель</th>
                <th>Телефон родителя</th>
                <th className="right">Посещ.</th>
                <th>Статус</th>
                {showMoney && <th className="right">Баланс</th>}
              </tr>
            </thead>
            <tbody>
              {enrolled === 0 && (
                <tr>
                  <td colSpan={showMoney ? 7 : 6}>
                    <div className="empty">В группе пока нет учеников</div>
                  </td>
                </tr>
              )}
              {group.students.map((s) => {
                const st = STUDENT_STATUS[s.status] ?? STUDENT_STATUS.ACTIVE;
                return (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/students/${s.id}`} className="person" style={{ color: "inherit", textDecoration: "none" }}>
                        <Avatar name={s.name} photoUrl={s.photoUrl} size={30} />
                        <div>
                          <div className="nm" style={{ fontSize: 13.5 }}>{s.name}</div>
                          {s.grade && <div className="mut" style={{ fontSize: 11.5 }}>{s.grade}</div>}
                        </div>
                      </Link>
                    </td>
                    <td className="num">
                      {s.phone ? <a href={telHref(s.phone)} style={{ color: "inherit" }}>{s.phone}</a> : <span className="mut">—</span>}
                    </td>
                    <td className="mut">{s.parentName || "—"}</td>
                    <td className="num">
                      {s.parentPhone ? <a href={telHref(s.parentPhone)} style={{ color: "inherit" }}>{s.parentPhone}</a> : <span className="mut">—</span>}
                    </td>
                    <td className="right num">
                      {s.attendance != null ? `${s.attendance}%` : <span className="mut">—</span>}
                    </td>
                    <td>
                      <span className={`chip ${st.cls}`}><span className="d" />{st.label}</span>
                    </td>
                    {showMoney && (
                      <td className="right money num" style={{ color: s.balance < 0 ? "var(--bad)" : "var(--ink-3)" }}>
                        {s.balance < 0 ? money(s.balance) : "0 ₸"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
