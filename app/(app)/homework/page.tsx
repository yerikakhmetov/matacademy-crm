import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData } from "@/lib/access";
import { getTeacherIdForUser, isTeacher } from "@/lib/teacher";
import { formatDate } from "@/lib/format";
import { ModalButton } from "@/components/ModalButton";
import { HomeworkForm } from "./HomeworkForm";
import { HomeworkStudents } from "./HomeworkStudents";
import { GroupSelect } from "./GroupSelect";
import { DeleteHomeworkButton } from "./DeleteHomeworkButton";
import { addHomework } from "@/app/actions/data";

export const dynamic = "force-dynamic";

export default async function HomeworkPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  const teacher = isTeacher(session?.user?.role);
  const canManage = await canEditData(session?.user?.role) || teacher;
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
            <h1>Домашние задания</h1>
            <p>Задания по группам</p>
          </div>
        </div>
        <div className="card">
          <div className="empty">{teacher ? "За вами пока не закреплены группы" : "Сначала создайте группу"}</div>
        </div>
      </>
    );
  }

  const groupId = sp.group && groups.some((g) => g.id === sp.group) ? sp.group : groups[0].id;
  const [group, homeworks] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, include: { students: { orderBy: { name: "asc" } } } }),
    prisma.homework.findMany({
      where: { groupId },
      include: { completions: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!group) return null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Домашние задания</h1>
          <p>{group.name} · {group.students.length} учеников</p>
        </div>
        {canManage && (
          <ModalButton label="Добавить ДЗ" title="Новое домашнее задание" action={addHomework.bind(null, groupId)} submitLabel="Задать">
            <HomeworkForm />
          </ModalButton>
        )}
      </div>

      <div className="toolbar">
        <GroupSelect groups={groups} groupId={groupId} />
      </div>

      {homeworks.length === 0 && (
        <div className="card">
          <div className="empty">Заданий пока нет{canManage ? " — добавьте первое" : ""}</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {homeworks.map((hw) => {
          const doneMap = new Map(hw.completions.map((c) => [c.studentId, c.done]));
          const doneCount = group.students.filter((s) => doneMap.get(s.id)).length;
          const overdue = hw.dueDate && new Date(hw.dueDate) < new Date();
          const students = group.students.map((s) => ({ id: s.id, name: s.name, done: !!doneMap.get(s.id) }));
          return (
            <div className="card" key={hw.id} style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "var(--font-display)" }}>{hw.title}</div>
                  {hw.description && <div className="mut" style={{ fontSize: 13, marginTop: 2 }}>{hw.description}</div>}
                  <div style={{ display: "flex", gap: 8, marginTop: 7, alignItems: "center", flexWrap: "wrap" }}>
                    {hw.dueDate && (
                      <span className={`chip ${overdue ? "c-bad" : "c-warn"}`}>
                        <span className="d" />
                        до {formatDate(hw.dueDate)}
                      </span>
                    )}
                    <span className="chip c-ok">
                      <span className="d" />
                      {doneCount}/{group.students.length} выполнили
                    </span>
                  </div>
                </div>
                {canManage && <DeleteHomeworkButton id={hw.id} />}
              </div>
              <div style={{ marginTop: 14, borderTop: "1px solid var(--line-2)", paddingTop: 14 }}>
                <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 700, marginBottom: 10 }}>
                  {canManage ? "Кто выполнил (нажмите на ученика)" : "Кто выполнил"}
                </div>
                <HomeworkStudents homeworkId={hw.id} students={students} canManage={canManage} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
