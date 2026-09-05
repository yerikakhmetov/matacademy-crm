import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData } from "@/lib/access";
import { isTeacher, getTeacherIdForUser } from "@/lib/teacher";
import { formatDate, initials, avatarColor, DAYS } from "@/lib/format";
import { ModalButton } from "@/components/ModalButton";
import { MakeupButtons } from "./MakeupButtons";
import { scheduleMakeup } from "@/app/actions/data";

export const dynamic = "force-dynamic";

export default async function MakeupsPage() {
  const session = await auth();
  const teacher = isTeacher(session?.user?.role);
  const editor = await canEditData(session?.user?.role);
  const myTeacherId = teacher ? await getTeacherIdForUser(session?.user?.id) : null;

  // Преподаватель видит только свои группы
  const groupWhere = teacher ? { teacherId: myTeacherId ?? "__none__" } : {};

  const [planned, doneRecent, excused] = await Promise.all([
    prisma.makeup.findMany({
      where: { status: "PLANNED", lesson: { group: groupWhere } },
      orderBy: { plannedAt: "asc" },
      include: {
        student: { select: { name: true } },
        lesson: { include: { group: { select: { name: true, color: true } } } },
      },
    }),
    prisma.makeup.findMany({
      where: { status: "DONE", lesson: { group: groupWhere } },
      orderBy: { plannedAt: "desc" },
      take: 10,
      include: {
        student: { select: { name: true } },
        lesson: { include: { group: { select: { name: true } } } },
      },
    }),
    // Уважительные пропуски за последний месяц
    prisma.attendance.findMany({
      where: {
        present: false,
        excused: true,
        date: { gte: new Date(Date.now() - 31 * 24 * 3600 * 1000) },
        lesson: { group: groupWhere },
      },
      orderBy: { date: "desc" },
      include: {
        student: { select: { id: true, name: true } },
        lesson: { include: { group: { select: { name: true, color: true } } } },
      },
    }),
  ]);

  // Кандидаты — пропуски, по которым отработка ещё не назначена
  const taken = new Set(
    (await prisma.makeup.findMany({
      where: { status: { in: ["PLANNED", "DONE"] } },
      select: { studentId: true, lessonId: true, missedDate: true },
    })).map((m) => `${m.studentId}|${m.lessonId}|${m.missedDate.toISOString().slice(0, 10)}`)
  );
  const candidates = excused.filter(
    (a) => !taken.has(`${a.studentId}|${a.lessonId}|${a.date.toISOString().slice(0, 10)}`)
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Отработки</h1>
          <p>Занятия, пропущенные по уважительной причине, проводятся в другой день</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <h3>Назначены</h3>
          <span className="chip c-mut"><span className="d" />{planned.length}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ученик</th>
                <th>Группа</th>
                <th>Пропуск</th>
                <th>Отработка</th>
                {editor && <th></th>}
              </tr>
            </thead>
            <tbody>
              {planned.length === 0 && (
                <tr><td colSpan={editor ? 5 : 4}><div className="empty">Назначенных отработок нет</div></td></tr>
              )}
              {planned.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="person">
                      <div className="av2" style={{ background: avatarColor(m.student.name) }}>{initials(m.student.name)}</div>
                      <div className="nm">{m.student.name}</div>
                    </div>
                  </td>
                  <td className="mut">{m.lesson.group.name}</td>
                  <td className="mut">{formatDate(m.missedDate)}</td>
                  <td style={{ fontWeight: 600 }}>{formatDate(m.plannedAt)}</td>
                  {editor && <td className="right"><MakeupButtons id={m.id} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <h3>Кому нужна отработка</h3>
          <span className="chip c-mut"><span className="d" />{candidates.length}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ученик</th>
                <th>Группа</th>
                <th>Пропустил</th>
                {editor && <th></th>}
              </tr>
            </thead>
            <tbody>
              {candidates.length === 0 && (
                <tr><td colSpan={editor ? 4 : 3}><div className="empty">Уважительных пропусков без отработки нет</div></td></tr>
              )}
              {candidates.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="person">
                      <div className="av2" style={{ background: avatarColor(a.student.name) }}>{initials(a.student.name)}</div>
                      <div className="nm">{a.student.name}</div>
                    </div>
                  </td>
                  <td className="mut">
                    {a.lesson.group.name} · {DAYS[a.lesson.dayOfWeek]} {a.lesson.startTime}
                  </td>
                  <td className="mut">{formatDate(a.date)}</td>
                  {editor && (
                    <td className="right">
                      <ModalButton
                        label="Назначить"
                        title={`Отработка · ${a.student.name}`}
                        icon="schedule"
                        buttonClass="btn ghost"
                        action={scheduleMakeup}
                        submitLabel="Назначить"
                      >
                        <input type="hidden" name="studentId" value={a.student.id} />
                        <input type="hidden" name="lessonId" value={a.lessonId} />
                        <input type="hidden" name="missedDate" value={a.date.toISOString().slice(0, 10)} />
                        <p className="mut" style={{ fontSize: 13, margin: "0 0 12px" }}>
                          Пропуск {formatDate(a.date)} по группе {a.lesson.group.name}. Выберите день отработки —
                          когда отметите её проведённой, ученику встанет посещение на эту дату.
                        </p>
                        <div className="field">
                          <label>Дата отработки</label>
                          <input name="plannedAt" type="date" defaultValue={today} required />
                        </div>
                        <div className="field">
                          <label>Комментарий</label>
                          <input name="note" placeholder="Например: во сколько прийти" />
                        </div>
                      </ModalButton>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {doneRecent.length > 0 && (
        <div className="card">
          <div className="card-h"><h3>Проведены</h3></div>
          <div style={{ padding: "6px 0" }}>
            {doneRecent.map((m) => (
              <div className="list-row" key={m.id}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{m.student.name}</div>
                  <div className="mut" style={{ fontSize: 12 }}>
                    {m.lesson.group.name} · пропуск {formatDate(m.missedDate)}
                  </div>
                </div>
                <span className="chip c-ok"><span className="d" />{formatDate(m.plannedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mut" style={{ fontSize: 12.5, marginTop: 14 }}>
        За пропуск по уважительной причине преподавателю не платят. Когда отработка проведена,
        ученику ставится посещение на её дату — и она оплачивается как обычное занятие,
        но суммарно за месяц с ученика начисляется не больше его месячной доли.
      </p>
    </>
  );
}
