import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEdit } from "@/lib/roles";
import { getTeacherIdForUser, isTeacher } from "@/lib/teacher";
import { initials, avatarColor, scoreColor } from "@/lib/format";
import { ModalButton } from "@/components/ModalButton";
import { GradeForm } from "./GradeForm";
import { GroupSelect } from "./GroupSelect";
import { GradeChips } from "./GradeChips";
import { addGrade } from "@/app/actions/data";

export const dynamic = "force-dynamic";

export default async function GradesPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  const teacher = isTeacher(session?.user?.role);
  const canManage = canEdit(session?.user?.role) || teacher;
  const myTeacherId = teacher ? await getTeacherIdForUser(session?.user?.id) : null;

  const groups = await prisma.group.findMany({
    where: teacher ? { teacherId: myTeacherId ?? "__none__" } : {},
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (groups.length === 0) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Успеваемость</h1>
            <p>Оценки учеников по группам</p>
          </div>
        </div>
        <div className="card">
          <div className="empty">{teacher ? "За вами пока не закреплены группы" : "Сначала создайте группу"}</div>
        </div>
      </>
    );
  }

  const groupId = sp.group && groups.some((g) => g.id === sp.group) ? sp.group : groups[0].id;
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      teacher: true,
      students: { orderBy: { name: "asc" }, include: { grades: { orderBy: { date: "desc" } } } },
    },
  });
  if (!group) return null;

  // Средняя по группе
  const allGrades = group.students.flatMap((s) => s.grades);
  const groupAvg =
    allGrades.length > 0 ? Math.round(allGrades.reduce((a, g) => a + (g.score / g.maxScore) * 100, 0) / allGrades.length) : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Успеваемость</h1>
          <p>
            {group.name} · {group.teacher?.name ?? "без преподавателя"}
          </p>
        </div>
        {groupAvg != null && (
          <div style={{ textAlign: "right" }}>
            <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600 }}>
              Средний балл группы
            </div>
            <div className="kval num" style={{ fontSize: 26, color: scoreColor(groupAvg) }}>
              {groupAvg}%
            </div>
          </div>
        )}
      </div>

      <div className="toolbar">
        <GroupSelect groups={groups} groupId={groupId} />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ученик</th>
                <th>Оценки (последние)</th>
                <th className="right">Средний</th>
                {canManage && <th className="right"></th>}
              </tr>
            </thead>
            <tbody>
              {group.students.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 4 : 3}>
                    <div className="empty">В группе нет учеников</div>
                  </td>
                </tr>
              )}
              {group.students.map((s) => {
                const avg =
                  s.grades.length > 0
                    ? Math.round(s.grades.reduce((a, g) => a + (g.score / g.maxScore) * 100, 0) / s.grades.length)
                    : null;
                return (
                  <tr key={s.id}>
                    <td>
                      <div className="person">
                        <div className="av2" style={{ background: avatarColor(s.name), width: 30, height: 30, fontSize: 11 }}>
                          {initials(s.name)}
                        </div>
                        <div className="nm" style={{ fontSize: 13.5 }}>
                          {s.name}
                        </div>
                      </div>
                    </td>
                    <td>
                      <GradeChips grades={s.grades.slice(0, 8)} canManage={canManage} />
                    </td>
                    <td className="right num" style={{ fontWeight: 700, color: avg != null ? scoreColor(avg) : "var(--ink-3)" }}>
                      {avg != null ? `${avg}%` : "—"}
                    </td>
                    {canManage && (
                      <td className="right">
                        <ModalButton
                          label="Оценка"
                          title={`Оценка · ${s.name}`}
                          icon="plus"
                          buttonClass="btn ghost"
                          action={addGrade.bind(null, s.id)}
                          submitLabel="Поставить"
                        >
                          <GradeForm />
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
    </>
  );
}
