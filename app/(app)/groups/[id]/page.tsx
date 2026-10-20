import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getAccess } from "@/lib/access";
import { getTeacherIdForUser, isTeacher } from "@/lib/teacher";
import { isCurator } from "@/lib/curator";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { StudentLinks } from "./StudentLinks";
import { DAYS, STUDENT_STATUS, formatDate, money } from "@/lib/format";
import { paidThrough, subjectShareOfTx } from "@/lib/payments";
import { lessonsLeftBySubject } from "@/lib/payroll";
import type { LessonsLeft } from "@/lib/packages";
import { getSettings } from "@/lib/settings";
import { schoolClock } from "@/lib/school-time";
import { cardCols } from "@/lib/card-table";
import { loadGroupRating } from "@/components/GroupRating";
import { RATING_POINTS } from "@/lib/rating";

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
      lessons: { where: { archivedAt: null }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      students: {
        orderBy: { name: "asc" },
        select: {
          id: true, name: true, phone: true, grade: true, status: true,
          joinToken: true, portalToken: true,
          parentName: true, parentPhone: true, attendance: true, balance: true, photoUrl: true,
          // когда реально приносили деньги: движение, а не дата счёта
          payments: {
            select: {
              // до какого числа оплачено — по полностью оплаченным счетам
              amount: true,
              paidAmount: true,
              date: true,
              months: true,
              // разбивка счёта по предметам: в группе показываем долю её предмета
              items: { select: { subjectId: true, amount: true } },
              txs: {
                where: { kind: "PAYMENT" },
                orderBy: { date: "desc" },
                take: 1,
                select: { date: true, amount: true },
              },
            },
          },
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

  // Куратору и менеджеру нужны ссылки на кабинет ученика и родительскую страницу.
  // Токены создаются лениво — у старых учеников их может не быть.
  const showLinks = !isTeacher(session?.user?.role);
  const links = new Map<string, { joinToken: string | null; portalToken: string | null }>();
  if (showLinks) {
    for (const s of group.students) {
      let joinToken = s.joinToken;
      let portalToken = s.portalToken;
      const data: { joinToken?: string; portalToken?: string } = {};
      if (!joinToken) data.joinToken = joinToken = crypto.randomUUID().replace(/-/g, "");
      if (!portalToken) data.portalToken = portalToken = crypto.randomUUID().replace(/-/g, "");
      if (Object.keys(data).length > 0) await prisma.student.update({ where: { id: s.id }, data });
      links.set(s.id, { joinToken, portalToken });
    }
  }

  const showMoney = can("finance");
  const enrolled = group.students.length;
  const pct = Math.min(100, Math.round((enrolled / group.capacity) * 100));
  const debtors = group.students.filter((s) => s.balance < 0);
  // «оплатил» — текущий месяц покрыт оплаченным счётом и нет непогашенного остатка
  // текущий месяц — по часам школы: от него считается цепочка «оплачено до»
  const tz = (await getSettings()).tzOffsetHours;
  const now = schoolClock(tz);
  // рейтинг группы за месяц — тот же, что видят ученики в кабинете, но с разбивкой очков
  const rating = await loadGroupRating(group.id, tz);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  // Счета, которые оплачивают предмет этой группы, и доля предмета в каждом.
  // У группы без предмета разбивки нет — берём счета целиком, как раньше.
  const subjectId = group.subjectId;
  const subjectPayments = (s: (typeof group.students)[number]) =>
    s.payments
      .map((p) => ({ ...p, share: subjectId ? p.items.filter((i) => i.subjectId === subjectId).reduce((a, i) => a + i.amount, 0) : p.amount }))
      .filter((p) => p.share > 0);
  // Группа с предметом: оплата — пакеты занятий, показываем остаток оплаченных занятий.
  // Без предмета — по-старому, «оплачено до» по календарным счетам.
  const left = subjectId ? await lessonsLeftBySubject(group.students.map((s) => s.id), subjectId) : null;
  const paidUntil = new Map(group.students.map((s) => [s.id, paidThrough(subjectPayments(s), now)]));
  const paid = group.students.filter((s) => {
    if (s.balance < 0) return false;
    if (left) return (left.get(s.id)?.left ?? 0) > 0;
    const until = paidUntil.get(s.id);
    return until != null && until >= monthStart;
  });

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
              {group.startDate ? ` · старт ${formatDate(group.startDate)}` : ""}
              {group.startDate == null ? " · дата начала не указана" : ""}
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
              <span className="kico" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}><Icon name="money" size={16} /></span>
              Оплатили
            </div>
            <div className="kval num">{paid.length}/{enrolled}</div>
            <div className="ktrend">{left ? "есть оплаченные занятия" : "текущий месяц оплачен"}</div>
          </div>
        )}
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
          <table {...cardCols(["Ученик", "Телефон ученика", "Родитель", "Телефон родителя", "Посещ.", "Статус", showMoney && "Оплата", showMoney && (group.subjectId ? "Оплата по предмету" : "Последний платёж"), showLinks && "Ссылки"])}>
            <thead>
              <tr>
                <th>Ученик</th>
                <th>Телефон ученика</th>
                <th>Родитель</th>
                <th>Телефон родителя</th>
                <th className="right">Посещ.</th>
                <th>Статус</th>
                {showMoney && <th>Оплата</th>}
                {showMoney && <th>{group.subjectId ? "Оплата по предмету" : "Последний платёж"}</th>}
                {showLinks && <th>Ссылки</th>}
              </tr>
            </thead>
            <tbody>
              {enrolled === 0 && (
                <tr>
                  <td colSpan={(showMoney ? 8 : 6) + (showLinks ? 1 : 0)}>
                    <div className="empty">В группе пока нет учеников</div>
                  </td>
                </tr>
              )}
              {group.students.map((s) => {
                const st = STUDENT_STATUS[s.status] ?? STUDENT_STATUS.ACTIVE;
                const until = paidUntil.get(s.id) ?? null;
                const covered = until != null && until >= monthStart;
                // последний приход денег по предмету группы: доля предмета, а не весь приход
                const lastPay = subjectPayments(s)
                  .flatMap((p) => p.txs.map((t) => ({ date: t.date, full: t.amount, amount: subjectShareOfTx(t.amount, p.amount, p.share) })))
                  .sort((a, b) => b.date.getTime() - a.date.getTime())[0] ?? null;
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
                      <>
                        <td>
                          {s.balance < 0 ? (
                            // долг важнее срока: по нему и звонят родителям
                            <span className="chip c-bad"><span className="d" />Долг {money(-s.balance)}</span>
                          ) : left ? (
                            <LessonsLeftChip info={left.get(s.id)} />
                          ) : until ? (
                            <span className={`chip ${covered ? "c-ok" : "c-warn"}`}>
                              <span className="d" />
                              {`оплачено до ${formatDate(until)}`}
                            </span>
                          ) : (
                            <span className="chip c-mut"><span className="d" />Нет оплат</span>
                          )}
                        </td>
                        <td className="mut">
                          {lastPay ? (
                            // одним блоком: на телефоне ячейка — строка карточки, части не должны разъезжаться
                            <span>
                              <span className="num" style={{ fontWeight: 600, color: "var(--ok)" }}>{money(lastPay.amount)}</span>
                              <span style={{ marginLeft: 6 }}>{formatDate(lastPay.date)}</span>
                              {lastPay.full !== lastPay.amount && (
                                <div style={{ fontSize: 11 }} title="Счёт оплачивает несколько предметов — здесь доля предмета этой группы">
                                  из {money(lastPay.full)} за все предметы
                                </div>
                              )}
                            </span>
                          ) : (
                            subjectId ? "оплат по предмету не было" : "оплат не было"
                          )}
                        </td>
                      </>
                    )}
                    {showLinks && (
                      <td>
                        <StudentLinks
                          joinToken={links.get(s.id)?.joinToken ?? null}
                          portalToken={links.get(s.id)?.portalToken ?? null}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {rating.rows.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-h">
            <h3>Рейтинг за месяц</h3>
            <span className="chip c-mut"><span className="d" />видят ученики группы</span>
          </div>
          <div className="table-wrap">
            <table {...cardCols(["Ученик", "Очки", "Занятия", "Оценки", "ДЗ", "Зачёты"])}>
              <thead>
                <tr>
                  <th>Ученик</th>
                  <th className="right">Очки</th>
                  <th className="right">Занятия</th>
                  <th className="right">Оценки</th>
                  <th className="right">ДЗ</th>
                  <th className="right">Зачёты</th>
                </tr>
              </thead>
              <tbody>
                {rating.rows.map((r) => {
                  const st = rating.students.get(r.studentId);
                  if (!st) return null;
                  return (
                    <tr key={r.studentId}>
                      <td>
                        <Link href={`/students/${r.studentId}`} className="person" style={{ color: "inherit", textDecoration: "none" }}>
                          <span className="num" style={{ width: 22, fontWeight: 800, color: r.place <= 3 && r.points > 0 ? "var(--accent)" : "var(--ink-3)" }}>{r.place}</span>
                          <Avatar name={st.name} photoUrl={st.photoUrl} size={28} />
                          <span className="nm" style={{ fontSize: 13.5 }}>{st.name}</span>
                        </Link>
                      </td>
                      <td className="right num" style={{ fontWeight: 700 }}>{r.points}</td>
                      <td className="right num mut">{r.parts.attend}</td>
                      <td className="right num mut">{r.parts.grades}</td>
                      <td className="right num mut">{r.parts.hw}</td>
                      <td className="right num mut">{r.parts.zachet}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mut" style={{ fontSize: 12, margin: 0, padding: "10px 18px 14px" }}>
            Очки за текущий месяц: занятие +{RATING_POINTS.attend}, оценка +1…10 (процент ÷ 10), выполненное ДЗ +{RATING_POINTS.hw},
            сданный зачёт +{RATING_POINTS.zachet}. Ученики видят у одногруппников только место и очки.
          </p>
        </div>
      )}
    </>
  );
}

// Остаток пакета занятий ученика по предмету группы.
// Мало осталось (≤ 2) — жёлтым: пора напомнить об оплате следующего месяца.
function LessonsLeftChip({ info }: { info?: LessonsLeft }) {
  if (!info || (info.total === 0 && info.unpaid === 0)) {
    return <span className="chip c-mut"><span className="d" />Нет оплат</span>;
  }
  if (info.left <= 0) {
    return (
      <span className={`chip ${info.unpaid > 0 ? "c-bad" : "c-warn"}`}>
        <span className="d" />
        {info.unpaid > 0 ? `без оплаты: ${info.unpaid} зан.` : "пакет закончился"}
      </span>
    );
  }
  return (
    <span className={`chip ${info.left <= 2 ? "c-warn" : "c-ok"}`} title={`Оплачено занятий: ${info.total}`}>
      <span className="d" />
      осталось {info.left} зан.
    </span>
  );
}
