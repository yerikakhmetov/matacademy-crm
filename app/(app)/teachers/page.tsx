import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEdit } from "@/lib/roles";
import { initials, avatarColor } from "@/lib/format";
import { ModalButton } from "@/components/ModalButton";
import { TeacherForm } from "./TeacherForm";
import { createTeacher } from "@/app/actions/data";

export const dynamic = "force-dynamic";

export default async function TeachersPage() {
  const session = await auth();
  const editor = canEdit(session?.user?.role);

  const teachers = await prisma.teacher.findMany({
    include: { groups: { include: { _count: { select: { students: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Учителя</h1>
          <p>{teachers.length} преподавателей · загрузка по группам</p>
        </div>
        {editor && (
          <ModalButton label="Преподаватель" title="Новый преподаватель" action={createTeacher}>
            <TeacherForm />
          </ModalButton>
        )}
      </div>

      <div className="grid teachers">
        {teachers.map((t) => {
          const groupCount = t.groups.length;
          const students = t.groups.reduce((a, g) => a + g._count.students, 0);
          const capacity = t.groups.reduce((a, g) => a + g.capacity, 0);
          const load = capacity > 0 ? Math.round((students / capacity) * 100) : 0;
          return (
            <div className="card tcard" key={t.id}>
              <div className="av2" style={{ background: t.color || avatarColor(t.name), width: 52, height: 52, fontSize: 17, borderRadius: 12 }}>
                {initials(t.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                  <div>
                    <div className="tn">{t.name}</div>
                    <div className="ts">{t.specialty}</div>
                  </div>
                  <span className="chip c-ok">
                    <span className="d" />★ 4.9
                  </span>
                </div>
                <div className="tstats">
                  <div>
                    <div className="k">Групп</div>
                    <div className="v num">{groupCount}</div>
                  </div>
                  <div>
                    <div className="k">Учеников</div>
                    <div className="v num">{students}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="k">Загрузка</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <div className="bar" style={{ flex: 1 }}>
                        <span style={{ width: `${load}%`, background: load > 85 ? "var(--warn)" : "var(--accent)" }} />
                      </div>
                      <span className="num" style={{ fontWeight: 700, fontSize: 13 }}>
                        {load}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {teachers.length === 0 && (
          <div className="card">
            <div className="empty">Преподавателей пока нет</div>
          </div>
        )}
      </div>
    </>
  );
}
