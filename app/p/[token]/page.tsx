import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import {
  money,
  initials,
  avatarColor,
  formatDate,
  subStatus,
  scoreColor,
  gradeChipClass,
  DAYS,
  GRADE_TYPE,
  PAYMENT_STATUS,
} from "@/lib/format";
import { Icon } from "@/components/Icon";
import { Avatar } from "@/components/Avatar";

export const dynamic = "force-dynamic";

export default async function ParentPortal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const student = await prisma.student.findUnique({
    where: { portalToken: token },
    include: {
      group: { include: { teacher: true, lessons: true } },
      grades: { orderBy: { date: "desc" }, take: 12 },
      payments: { orderBy: { date: "desc" }, take: 8 },
      subscriptions: { orderBy: { startDate: "desc" }, take: 1 },
    },
  });
  if (!student) notFound();
  const settings = await getSettings();

  const homeworks = student.group
    ? await prisma.homework.findMany({
        where: { groupId: student.group.id },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { completions: { where: { studentId: student.id } } },
      })
    : [];

  const avg =
    student.grades.length > 0
      ? Math.round(student.grades.reduce((a, g) => a + (g.score / g.maxScore) * 100, 0) / student.grades.length)
      : null;
  const sub = student.subscriptions[0];
  const ss = sub ? subStatus(sub.endDate) : null;
  const lessons = [...(student.group?.lessons ?? [])].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));

  return (
    <div style={{ minHeight: "100vh", background: "var(--ground)", padding: "24px 16px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Шапка */}
        <div className="card" style={{ padding: 22, display: "flex", alignItems: "center", gap: 16 }}>
          <Avatar name={student.name} photoUrl={student.photoUrl} size={56} radius={14} fontSize={19} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 22 }}>{student.name}</h1>
            <p className="mut" style={{ fontSize: 13.5, margin: "2px 0 0" }}>
              {student.grade ?? ""} · {student.group?.name ?? "без группы"}
              {student.group?.teacher ? ` · ${student.group.teacher.name}` : ""}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>{settings.schoolName}</div>
            <div className="mut" style={{ fontSize: 11.5 }}>Дневник ученика</div>
          </div>
        </div>

        {/* Показатели */}
        <div className="grid kpis" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          <div className="card kpi">
            <div className="klabel">
              <span className="kico" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>
                <Icon name="check" size={16} />
              </span>
              Посещаемость
            </div>
            <div className="kval num" style={{ color: scoreColor(student.attendance) }}>{student.attendance}%</div>
          </div>
          <div className="card kpi">
            <div className="klabel">
              <span className="kico" style={{ background: "var(--violet-soft)", color: "var(--violet)" }}>
                <Icon name="chart" size={16} />
              </span>
              Средний балл
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
              Баланс
            </div>
            <div className="kval num" style={{ fontSize: 22, color: student.balance < 0 ? "var(--bad)" : "var(--ok)" }}>
              {student.balance < 0 ? money(student.balance) : "Нет долга"}
            </div>
          </div>
        </div>

        {/* Абонемент + расписание */}
        <div className="two-col">
          <div className="card">
            <div className="card-h"><h3>Расписание</h3></div>
            <div style={{ padding: "6px 0" }}>
              {lessons.length === 0 && <div className="empty">Расписание не задано</div>}
              {lessons.map((l) => (
                <div className="list-row" key={l.id}>
                  <div style={{ width: 40, fontWeight: 700 }}>{DAYS[l.dayOfWeek]}</div>
                  <div className="num" style={{ width: 54, fontWeight: 600 }}>{l.startTime}</div>
                  <div style={{ flex: 1 }} className="mut">{l.room}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-h">
              <h3>Абонемент</h3>
              {ss && (
                <span className={`chip ${ss.cls}`}>
                  <span className="d" />
                  {ss.label}
                </span>
              )}
            </div>
            <div style={{ padding: 18 }}>
              {sub ? (
                <dl className="dl">
                  <dt>Тариф</dt>
                  <dd>{sub.plan}</dd>
                  <dt>Действует</dt>
                  <dd>{formatDate(sub.startDate)}{sub.endDate ? ` — ${formatDate(sub.endDate)}` : ""}</dd>
                  <dt>Стоимость</dt>
                  <dd>{money(sub.price)}</dd>
                </dl>
              ) : (
                <div className="empty">Активного абонемента нет</div>
              )}
            </div>
          </div>
        </div>

        {/* Домашние задания */}
        <div className="card">
          <div className="card-h">
            <h3>Домашние задания</h3>
            <span className="chip c-mut"><span className="d" />{homeworks.length}</span>
          </div>
          <div style={{ padding: "6px 0" }}>
            {homeworks.length === 0 && <div className="empty">Заданий пока нет</div>}
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
                        срок: {formatDate(hw.dueDate)}
                      </div>
                    )}
                  </div>
                  <span className={`chip ${done ? "c-ok" : "c-mut"}`}>
                    <span className="d" />
                    {done ? "Выполнено" : "Не выполнено"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Оценки */}
        <div className="card">
          <div className="card-h">
            <h3>Оценки</h3>
            <span className="chip c-mut"><span className="d" />{student.grades.length}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>За что</th>
                  <th>Тип</th>
                  <th>Дата</th>
                  <th className="right">Оценка</th>
                </tr>
              </thead>
              <tbody>
                {student.grades.length === 0 && (
                  <tr><td colSpan={4}><div className="empty">Оценок пока нет</div></td></tr>
                )}
                {student.grades.map((g) => {
                  const pct = Math.round((g.score / g.maxScore) * 100);
                  return (
                    <tr key={g.id}>
                      <td style={{ fontWeight: 600 }}>{g.topic}</td>
                      <td className="mut">{GRADE_TYPE[g.type] ?? g.type}</td>
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

        {/* Оплаты */}
        <div className="card">
          <div className="card-h">
            <h3>История оплат</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Назначение</th>
                  <th>Дата</th>
                  <th>Статус</th>
                  <th className="right">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {student.payments.length === 0 && (
                  <tr><td colSpan={4}><div className="empty">Оплат пока нет</div></td></tr>
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
          {settings.schoolName} · страница обновляется автоматически
        </p>
      </div>
    </div>
  );
}
