import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getTeacherIdForUser, isTeacher } from "@/lib/teacher";
import { initials, avatarColor, STUDENT_STATUS } from "@/lib/format";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

const ci = (q: string) => ({ contains: q, mode: "insensitive" as const });

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const term = q.trim();
  const session = await auth();
  const teacher = isTeacher(session?.user?.role);
  const myTeacherId = teacher ? await getTeacherIdForUser(session?.user?.id) : null;
  const groupScope = teacher ? { teacherId: myTeacherId ?? "__none__" } : {};

  if (!term) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Поиск</h1>
            <p>Введите имя ученика, группы, телефон или лид в строке поиска сверху</p>
          </div>
        </div>
        <div className="card">
          <div className="empty">Начните вводить запрос в поле поиска ↑</div>
        </div>
      </>
    );
  }

  const [students, groups, leads, teachers] = await Promise.all([
    prisma.student.findMany({
      where: {
        AND: [
          groupScope.teacherId ? { groups: { some: groupScope } } : {},
          { OR: [{ name: ci(term) }, { phone: ci(term) }, { parentName: ci(term) }, { parentPhone: ci(term) }, { grade: ci(term) }] },
        ],
      },
      include: { groups: { select: { name: true } } },
      take: 20,
      orderBy: { name: "asc" },
    }),
    prisma.group.findMany({
      where: { AND: [groupScope, { OR: [{ name: ci(term) }, { level: ci(term) }] }] },
      include: { teacher: true },
      take: 20,
      orderBy: { name: "asc" },
    }),
    teacher
      ? Promise.resolve([])
      : prisma.lead.findMany({
          where: { OR: [{ name: ci(term) }, { childName: ci(term) }, { phone: ci(term) }, { subject: ci(term) }] },
          take: 20,
          orderBy: { createdAt: "desc" },
        }),
    teacher
      ? Promise.resolve([])
      : prisma.teacher.findMany({
          where: { OR: [{ name: ci(term) }, { specialty: ci(term) }] },
          take: 20,
          orderBy: { name: "asc" },
        }),
  ]);

  const total = students.length + groups.length + leads.length + teachers.length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Результаты поиска</h1>
          <p>
            По запросу «{term}» — найдено {total}
          </p>
        </div>
      </div>

      {total === 0 && (
        <div className="card">
          <div className="empty">Ничего не найдено по запросу «{term}»</div>
        </div>
      )}

      {students.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-h">
            <h3>Ученики</h3>
            <span className="chip c-mut">
              <span className="d" />
              {students.length}
            </span>
          </div>
          <div style={{ padding: "6px 0" }}>
            {students.map((s) => {
              const st = STUDENT_STATUS[s.status] ?? STUDENT_STATUS.ACTIVE;
              return (
                <Link key={s.id} href={teacher ? "/students" : `/students/${s.id}`} className="list-row" style={{ textDecoration: "none" }}>
                  <div className="av2" style={{ background: avatarColor(s.name) }}>
                    {initials(s.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    <div className="mut" style={{ fontSize: 12 }}>
                      {s.grade ?? "—"} · {s.groups.length ? s.groups.map((g) => g.name).join(", ") : "без группы"}
                    </div>
                  </div>
                  <span className={`chip ${st.cls}`}>
                    <span className="d" />
                    {st.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {groups.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-h">
            <h3>Группы</h3>
            <span className="chip c-mut">
              <span className="d" />
              {groups.length}
            </span>
          </div>
          <div style={{ padding: "6px 0" }}>
            {groups.map((g) => (
              <Link key={g.id} href="/groups" className="list-row" style={{ textDecoration: "none" }}>
                <div className="gtag" style={{ background: g.color, width: 34, height: 34, borderRadius: 9, fontSize: 13 }}>
                  {g.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{g.name}</div>
                  <div className="mut" style={{ fontSize: 12 }}>
                    {g.level} · {g.teacher?.name ?? "без преподавателя"}
                  </div>
                </div>
                <Icon name="groups" size={16} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {leads.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-h">
            <h3>Лиды</h3>
            <span className="chip c-mut">
              <span className="d" />
              {leads.length}
            </span>
          </div>
          <div style={{ padding: "6px 0" }}>
            {leads.map((l) => (
              <Link key={l.id} href={`/leads/${l.id}`} className="list-row" style={{ textDecoration: "none" }}>
                <div className="av2" style={{ background: avatarColor(l.name) }}>
                  {initials(l.name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{l.name}</div>
                  <div className="mut" style={{ fontSize: 12 }}>
                    {l.childName ?? ""} {l.grade ?? ""} {l.subject ? `· ${l.subject}` : ""}
                  </div>
                </div>
                <Icon name="leads" size={16} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {teachers.length > 0 && (
        <div className="card">
          <div className="card-h">
            <h3>Преподаватели</h3>
            <span className="chip c-mut">
              <span className="d" />
              {teachers.length}
            </span>
          </div>
          <div style={{ padding: "6px 0" }}>
            {teachers.map((t) => (
              <Link key={t.id} href="/teachers" className="list-row" style={{ textDecoration: "none" }}>
                <div className="av2" style={{ background: t.color || avatarColor(t.name) }}>
                  {initials(t.name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  <div className="mut" style={{ fontSize: 12 }}>
                    {t.specialty}
                  </div>
                </div>
                <Icon name="teachers" size={16} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
