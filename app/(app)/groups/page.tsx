import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEdit } from "@/lib/roles";
import { ModalButton } from "@/components/ModalButton";
import { GroupForm } from "./GroupForm";
import { createGroup } from "@/app/actions/data";
import { DAYS } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const session = await auth();
  const editor = canEdit(session?.user?.role);

  const [groups, teachers] = await Promise.all([
    prisma.group.findMany({
      include: { teacher: true, _count: { select: { students: true } }, lessons: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.teacher.findMany({ orderBy: { name: "asc" } }),
  ]);

  const avgFill =
    groups.length > 0 ? Math.round(groups.reduce((a, g) => a + g._count.students / g.capacity, 0) / groups.length * 100) : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Группы</h1>
          <p>
            {groups.length} групп · средняя наполняемость {avgFill}%
          </p>
        </div>
        {editor && (
          <ModalButton label="Новая группа" title="Новая группа" action={createGroup}>
            <GroupForm teachers={teachers} />
          </ModalButton>
        )}
      </div>

      <div className="grid groups">
        {groups.map((g) => {
          const enrolled = g._count.students;
          const pct = Math.min(100, Math.round((enrolled / g.capacity) * 100));
          const full = enrolled >= g.capacity;
          const scheduleText = g.lessons
            .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
            .map((l) => DAYS[l.dayOfWeek])
            .join(" · ");
          const firstTime = g.lessons[0]?.startTime;
          return (
            <div className="card gcard" key={g.id}>
              <div className="gtop">
                <div>
                  <div className="gname">{g.name}</div>
                  <div className="gsub">
                    {g.level}
                    {scheduleText ? ` · ${scheduleText}` : ""}
                    {firstTime ? ` · ${firstTime}` : ""}
                  </div>
                </div>
                <div className="gtag" style={{ background: g.color }}>
                  {g.name[0]}
                </div>
              </div>
              <div className="gmeta">
                <div>
                  <span className="k">Учитель</span>
                  <br />
                  <span className="v">{g.teacher?.name ?? "—"}</span>
                </div>
                <div>
                  <span className="k">Наполнен.</span>
                  <br />
                  <span className="v num">
                    {enrolled}/{g.capacity}
                  </span>
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 11.5 }}>
                  <span className="mut">Мест занято</span>
                  <span style={{ fontWeight: 700, color: full ? "var(--bad)" : g.color }}>{full ? "Группа полная" : pct + "%"}</span>
                </div>
                <div className="bar">
                  <span style={{ width: `${pct}%`, background: full ? "var(--bad)" : g.color }} />
                </div>
              </div>
            </div>
          );
        })}
        {groups.length === 0 && (
          <div className="card">
            <div className="empty">Групп пока нет</div>
          </div>
        )}
      </div>
    </>
  );
}
