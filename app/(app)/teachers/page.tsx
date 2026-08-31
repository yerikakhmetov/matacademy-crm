import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData, requireAccess } from "@/lib/access";
import { isTeacher } from "@/lib/teacher";
import { Avatar } from "@/components/Avatar";
import { PhotoUpload } from "@/components/PhotoUpload";
import { ModalButton } from "@/components/ModalButton";
import { TeacherForm } from "./TeacherForm";
import { DeleteTeacherButton } from "./DeleteTeacherButton";
import { TeacherTelegramLogin } from "./TeacherTelegramLogin";
import { createTeacher, updateTeacher } from "@/app/actions/data";

export const dynamic = "force-dynamic";

export default async function TeachersPage() {
  const session = await auth();
  if (isTeacher(session?.user?.role)) redirect("/dashboard");
  await requireAccess("teachers");
  const editor = await canEditData(session?.user?.role);

  const [teachers, subjects] = await Promise.all([
    prisma.teacher.findMany({
      include: {
        groups: { include: { _count: { select: { students: true } } } },
        subjects: { select: { id: true, name: true, color: true } },
        user: { select: { telegramUserId: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.subject.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
  ]);
  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Учителя</h1>
          <p>{teachers.length} преподавателей · загрузка по группам</p>
        </div>
        {editor && (
          <ModalButton label="Преподаватель" title="Новый преподаватель" action={createTeacher}>
            <TeacherForm subjects={subjects} />
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
              <Avatar name={t.name} photoUrl={t.photoUrl} size={52} radius={12} bg={t.color} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                  <div>
                    <div className="tn">{t.name}</div>
                    <div className="ts">{t.specialty}</div>
                    {t.subjects.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                        {t.subjects.map((s) => (
                          <span key={s.id} className="chip" style={{ padding: "1px 8px", fontSize: 10.5, background: `${s.color}22`, color: s.color }}>
                            {s.name}
                          </span>
                        ))}
                      </div>
                    )}
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
                {editor && (
                  <div style={{ display: "flex", gap: 8, marginTop: 14, borderTop: "1px solid var(--line-2)", paddingTop: 12 }}>
                    <ModalButton
                      label="Редактировать"
                      title={`Преподаватель · ${t.name}`}
                      icon="edit"
                      buttonClass="btn ghost"
                      action={updateTeacher.bind(null, t.id)}
                    >
                      <div style={{ paddingBottom: 8, borderBottom: "1px solid var(--line-2)", marginBottom: 4 }}>
                        <PhotoUpload entity="teacher" id={t.id} name={t.name} photoUrl={t.photoUrl} size={64} />
                      </div>
                      <TeacherForm values={{ ...t, subjectIds: t.subjects.map((s) => s.id) }} subjects={subjects} />
                      <div style={{ borderTop: "1px solid var(--line-2)", paddingTop: 14, marginTop: 4 }}>
                        <TeacherTelegramLogin
                          teacherId={t.id}
                          linked={!!t.user?.telegramUserId}
                          botUsername={botUsername}
                        />
                      </div>
                    </ModalButton>
                    <DeleteTeacherButton id={t.id} name={t.name} hasGroups={groupCount > 0} />
                  </div>
                )}
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
