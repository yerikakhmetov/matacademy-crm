import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getTeacherIdForUser, isTeacher } from "@/lib/teacher";
import { scoreColor, STUDENT_STATUS } from "@/lib/format";
import { Avatar } from "@/components/Avatar";

export const dynamic = "force-dynamic";

// Список учеников преподавателя (без финансов). Доступен учителю; админ/менеджер видят всех.
export default async function MyStudentsPage() {
  const session = await auth();
  const teacher = isTeacher(session?.user?.role);
  const myTeacherId = teacher ? await getTeacherIdForUser(session?.user?.id) : null;

  const groups = await prisma.group.findMany({
    where: teacher ? { teacherId: myTeacherId ?? "__none__" } : {},
    orderBy: { name: "asc" },
    include: {
      students: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, grade: true, status: true, attendance: true, phone: true, parentName: true, parentPhone: true, photoUrl: true, grades: { select: { score: true, maxScore: true } } },
      },
    },
  });

  const totalStudents = groups.reduce((a, g) => a + g.students.length, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Мои ученики</h1>
          <p>{totalStudents} учеников · {groups.length} групп</p>
        </div>
      </div>

      {groups.length === 0 && (
        <div className="card">
          <div className="empty">Пока нет групп с учениками</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {groups.map((g) => (
          <div className="card" key={g.id}>
            <div className="card-h">
              <h3>{g.name}</h3>
              <span className="chip c-mut">
                <span className="d" />
                {g.students.length}
              </span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ученик</th>
                    <th>Класс</th>
                    <th>Родитель</th>
                    <th>Посещаемость</th>
                    <th className="right">Средний балл</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {g.students.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty">В группе нет учеников</div>
                      </td>
                    </tr>
                  )}
                  {g.students.map((s) => {
                    const st = STUDENT_STATUS[s.status] ?? STUDENT_STATUS.ACTIVE;
                    const avg = s.grades.length ? Math.round(s.grades.reduce((a, gr) => a + (gr.score / gr.maxScore) * 100, 0) / s.grades.length) : null;
                    return (
                      <tr key={s.id}>
                        <td>
                          <div className="person">
                            <Avatar name={s.name} photoUrl={s.photoUrl} size={32} />
                            <div>
                              <div className="nm" style={{ fontSize: 13.5 }}>{s.name}</div>
                              <div className="sub">{s.phone ?? "тел. не указан"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="mut">{s.grade ?? "—"}</td>
                        <td className="mut">{s.parentName ?? "—"}</td>
                        <td>
                          <span className="num" style={{ fontWeight: 700, color: s.attendance == null ? "var(--ink-3)" : scoreColor(s.attendance) }}>{s.attendance == null ? "—" : `${s.attendance}%`}</span>
                        </td>
                        <td className="right num" style={{ fontWeight: 700, color: avg != null ? scoreColor(avg) : "var(--ink-3)" }}>
                          {avg != null ? `${avg}%` : "—"}
                        </td>
                        <td>
                          <span className={`chip ${st.cls}`}>
                            <span className="d" />
                            {st.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
