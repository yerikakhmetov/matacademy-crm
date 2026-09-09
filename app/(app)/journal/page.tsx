import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getTeacherIdForUser, isTeacher } from "@/lib/teacher";
import { initials, avatarColor } from "@/lib/format";
import { JournalFilters } from "./JournalFilters";

export const dynamic = "force-dynamic";

const MONTH_NAMES = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

// Даты в месяце, совпадающие с днём недели (1..6, Пн..Сб). Всё в UTC — как хранятся отметки.
function datesInMonth(year: number, month0: number, dayOfWeek: number): Date[] {
  const res: Date[] = [];
  const d = new Date(Date.UTC(year, month0, 1));
  while (d.getUTCMonth() === month0) {
    const js = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    if (js === dayOfWeek) res.push(new Date(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return res;
}

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ group?: string; month?: string }> }) {
  const sp = await searchParams;

  const session = await auth();
  const teacher = isTeacher(session?.user?.role);
  const myTeacherId = teacher ? await getTeacherIdForUser(session?.user?.id) : null;

  const groups = await prisma.group.findMany({
    where: teacher ? { teacherId: myTeacherId ?? "__none__" } : {},
    orderBy: { name: "asc" },
  });
  if (groups.length === 0) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Журнал посещаемости</h1>
            <p>Сводка по группе за месяц</p>
          </div>
        </div>
        <div className="card">
          <div className="empty">Сначала создайте группу и занятия</div>
        </div>
      </>
    );
  }

  const groupId = sp.group && groups.some((g) => g.id === sp.group) ? sp.group : groups[0].id;

  // Список месяцев: текущий и 5 предыдущих
  const now = new Date();
  const monthOpts = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const id = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { id, name: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` };
  });
  const month = sp.month && monthOpts.some((m) => m.id === sp.month) ? sp.month : monthOpts[0].id;
  const [year, mon] = month.split("-").map(Number);
  const month0 = mon - 1;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      teacher: true,
      students: { orderBy: { name: "asc" } },
      lessons: true,
    },
  });
  if (!group) return null;

  // Все занятия-даты группы в этом месяце
  type Occ = { lessonId: string; date: Date; iso: string; day: number; time: string };
  const occurrences: Occ[] = [];
  // до даты начала группы занятий не было — их не должно быть и в журнале
  const startsAt = group.startDate
    ? Date.UTC(group.startDate.getUTCFullYear(), group.startDate.getUTCMonth(), group.startDate.getUTCDate())
    : null;
  for (const l of group.lessons) {
    for (const d of datesInMonth(year, month0, l.dayOfWeek)) {
      if (startsAt !== null && d.getTime() < startsAt) continue;
      occurrences.push({ lessonId: l.id, date: d, iso: d.toISOString().slice(0, 10), day: d.getUTCDate(), time: l.startTime });
    }
  }
  occurrences.sort((a, b) => a.date.getTime() - b.date.getTime() || a.time.localeCompare(b.time));

  // Отметки по всем занятиям группы за месяц
  const lessonIds = group.lessons.map((l) => l.id);
  const monthStart = new Date(Date.UTC(year, month0, 1));
  const monthEnd = new Date(Date.UTC(year, month0 + 1, 1));
  const records = lessonIds.length
    ? await prisma.attendance.findMany({ where: { lessonId: { in: lessonIds }, date: { gte: monthStart, lt: monthEnd } } })
    : [];
  // ключ: lessonId|iso|studentId -> состояние отметки
  type Cell = "present" | "excused" | "unexcused";
  const recMap = new Map<string, Cell>();
  for (const r of records) {
    const state: Cell = r.present ? "present" : r.excused ? "excused" : "unexcused";
    recMap.set(`${r.lessonId}|${r.date.toISOString().slice(0, 10)}|${r.studentId}`, state);
  }

  // Итоги по ученику. Уважительный пропуск не входит в знаменатель —
  // так же, как в общем показателе посещаемости и в расчёте зарплаты.
  function summary(studentId: string) {
    let present = 0,
      marked = 0,
      excused = 0;
    for (const o of occurrences) {
      const v = recMap.get(`${o.lessonId}|${o.iso}|${studentId}`);
      if (v === undefined) continue;
      if (v === "excused") {
        excused++;
        continue;
      }
      marked++;
      if (v === "present") present++;
    }
    return { present, marked, excused, pct: marked ? Math.round((present / marked) * 100) : null };
  }

  // занятие считается отмеченным, если по нему есть хоть одна запись
  const markedOcc = new Set(records.map((r) => `${r.lessonId}|${r.date.toISOString().slice(0, 10)}`));
  const unmarked = occurrences.filter((o) => !markedOcc.has(`${o.lessonId}|${o.iso}`)).length;

  const counted = records.filter((r) => r.present || !r.excused);
  const totalPresent = records.filter((r) => r.present).length;
  const groupPct = counted.length ? Math.round((totalPresent / counted.length) * 100) : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Журнал посещаемости</h1>
          <p>
            {group.name} · {group.teacher?.name ?? "без преподавателя"} · {monthOpts.find((m) => m.id === month)?.name}
          </p>
        </div>
        <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
          <div style={{ textAlign: "right" }}>
            <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600 }}>
              Средняя за месяц
            </div>
            <div className="kval num" style={{ fontSize: 26, color: groupPct != null && groupPct >= 85 ? "var(--ok)" : "var(--warn)" }}>
              {groupPct != null ? groupPct + "%" : "—"}
            </div>
          </div>
        </div>
      </div>

      <JournalFilters groups={groups} months={monthOpts} groupId={groupId} month={month} />

      {occurrences.length > 0 && (
        <p className="mut" style={{ fontSize: 12.5, margin: "0 0 12px" }}>
          Нажмите на клетку или на число сверху — откроется это занятие, там отмечается посещаемость.
          {unmarked > 0 && (
            <span style={{ color: "var(--warn)", fontWeight: 600 }}> Не отмечено занятий: {unmarked}.</span>
          )}
        </p>
      )}

      <div className="card">
        {occurrences.length === 0 ? (
          <div className="empty">В этом месяце у группы нет занятий по расписанию</div>
        ) : group.students.length === 0 ? (
          <div className="empty">В группе нет учеников</div>
        ) : (
          <div className="table-wrap">
            <table className="journal">
              <thead>
                <tr>
                  <th className="jsticky">Ученик</th>
                  {occurrences.map((o, i) => {
                    const done = markedOcc.has(`${o.lessonId}|${o.iso}`);
                    return (
                      <th key={i} style={{ textAlign: "center", minWidth: 40 }}>
                        <Link
                          href={`/schedule/${o.lessonId}?date=${o.iso}`}
                          title={done ? `Открыть занятие ${o.day} · ${o.time}` : `Занятие ${o.day} · ${o.time} ещё не отмечено`}
                          style={{
                            color: done ? "inherit" : "var(--warn)",
                            textDecoration: "none",
                            fontWeight: done ? 600 : 800,
                            display: "block",
                          }}
                        >
                          {o.day}
                          {!done && <span style={{ display: "block", fontSize: 9, lineHeight: 1 }}>•</span>}
                        </Link>
                      </th>
                    );
                  })}
                  <th style={{ textAlign: "right" }}>Итог</th>
                </tr>
              </thead>
              <tbody>
                {group.students.map((s) => {
                  const sum = summary(s.id);
                  return (
                    <tr key={s.id}>
                      <td className="jsticky">
                        <div className="person">
                          <div className="av2" style={{ background: avatarColor(s.name), width: 28, height: 28, fontSize: 11 }}>
                            {initials(s.name)}
                          </div>
                          <div className="nm" style={{ fontSize: 13 }}>
                            {s.name}
                          </div>
                        </div>
                      </td>
                      {occurrences.map((o, i) => {
                        const v = recMap.get(`${o.lessonId}|${o.iso}|${s.id}`);
                        return (
                          <td key={i} style={{ textAlign: "center", padding: "8px 6px" }}>
                            {/* клетка ведёт на само занятие — отсюда отметку и правят */}
                            <Link
                              href={`/schedule/${o.lessonId}?date=${o.iso}`}
                              title={`${s.name} · ${o.day} ${MONTH_NAMES[month0]} · открыть занятие`}
                              style={{ textDecoration: "none", color: "inherit", display: "block" }}
                            >
                              {v === undefined ? (
                                <span className="jcell jnone">·</span>
                              ) : v === "present" ? (
                                <span className="jcell jyes">✓</span>
                              ) : v === "excused" ? (
                                <span className="jcell jnone">У</span>
                              ) : (
                                <span className="jcell jno">✕</span>
                              )}
                            </Link>
                          </td>
                        );
                      })}
                      <td style={{ textAlign: "right" }}>
                        {sum.marked === 0 ? (
                          <span className="mut">{sum.excused > 0 ? `${sum.excused} уваж.` : "—"}</span>
                        ) : (
                          <span className="num" style={{ fontWeight: 700, color: sum.pct! >= 85 ? "var(--ok)" : sum.pct! >= 70 ? "var(--warn)" : "var(--bad)" }}>
                            {sum.present}/{sum.marked} · {sum.pct}%
                            {sum.excused > 0 && <span className="mut" style={{ fontWeight: 500 }}> · {sum.excused} уваж.</span>}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 18, marginTop: 14, fontSize: 12.5 }} className="mut">
        <span>
          <span className="jcell jyes">✓</span> присутствовал
        </span>
        <span>
          <span className="jcell jno">✕</span> отсутствовал
        </span>
        <span>
          <span className="jcell jnone">·</span> не отмечено
        </span>
      </div>
    </>
  );
}
