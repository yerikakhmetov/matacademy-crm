import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData } from "@/lib/access";
import { curatorGroupIds, isCurator } from "@/lib/curator";
import { getSettings } from "@/lib/settings";
import { schoolClock } from "@/lib/school-time";
import { utcToSchoolParts, zachetSummary } from "@/lib/zachet";
import { ModalButton } from "@/components/ModalButton";
import { createZachet } from "@/app/actions/zachets";
import { ZachetForm } from "./ZachetForm";
import { cardCols } from "@/lib/card-table";

export const dynamic = "force-dynamic";

// Зачёты групп. Ведёт куратор (только свои группы); админ и менеджер видят все.
export default async function ZachetsPage() {
  const session = await auth();
  const curator = isCurator(session?.user?.role);
  const editor = await canEditData(session?.user?.role);
  if (!curator && !editor) redirect("/dashboard");

  const groupIds = curator ? await curatorGroupIds(session?.user?.id) : null;
  const groupWhere = groupIds ? { id: { in: groupIds } } : {};
  const tz = (await getSettings()).tzOffsetHours;
  const today = schoolClock(tz).toISOString().slice(0, 10);

  const [groups, zachets] = await Promise.all([
    prisma.group.findMany({ where: groupWhere, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.zachet.findMany({
      where: { group: groupWhere },
      orderBy: { scheduledAt: "desc" },
      take: 100,
      include: {
        group: { select: { name: true, color: true, students: { where: { status: "ACTIVE" }, select: { id: true } } } },
        results: { select: { studentId: true, passed: true } },
      },
    }),
  ]);

  const now = Date.now();
  const upcoming = zachets.filter((z) => z.scheduledAt.getTime() > now).reverse(); // ближайший — первым
  const past = zachets.filter((z) => z.scheduledAt.getTime() <= now);
  const when = (d: Date) => {
    const p = utcToSchoolParts(d, tz);
    return `${p.date.slice(8, 10)}.${p.date.slice(5, 7)}.${p.date.slice(0, 4)} · ${p.time}`;
  };

  const table = (list: typeof zachets, empty: string) => (
    <div className="table-wrap">
      <table {...cardCols(["Зачёт", "Группа", "Когда", "Итог"])}>
        <thead>
          <tr>
            <th>Зачёт</th>
            <th>Группа</th>
            <th>Когда</th>
            <th className="right">Итог</th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && (
            <tr>
              <td colSpan={4}>
                <div className="empty">{empty}</div>
              </td>
            </tr>
          )}
          {list.map((z) => {
            const s = zachetSummary(z.group.students.map((x) => x.id), z.results);
            return (
              <tr key={z.id}>
                <td>
                  <Link href={`/zachets/${z.id}`} style={{ fontWeight: 600, color: "inherit" }}>
                    {z.topic}
                  </Link>
                </td>
                <td>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: z.group.color || "#3A5AE0" }} />
                    {z.group.name}
                  </span>
                </td>
                <td className="num">{when(z.scheduledAt)}</td>
                <td className="right">
                  <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {s.passed > 0 && <span className="chip c-ok"><span className="d" />сдали {s.passed}</span>}
                    {s.failed > 0 && <span className="chip c-bad"><span className="d" />не сдали {s.failed}</span>}
                    {s.unmarked > 0 && (
                      <span className={`chip ${z.scheduledAt.getTime() <= now ? "c-warn" : "c-mut"}`}>
                        <span className="d" />
                        {z.scheduledAt.getTime() <= now ? `не отмечено ${s.unmarked}` : `${s.total} уч.`}
                      </span>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Зачёты</h1>
          <p>
            {curator ? "Зачёты ваших групп" : "Зачёты всех групп"} · результат «сдал / не сдал» видят родители и ученик
          </p>
        </div>
        {groups.length > 0 && (
          <ModalButton label="Назначить зачёт" title="Новый зачёт" action={createZachet}>
            <ZachetForm groups={groups} defaultDate={today} />
          </ModalButton>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <h3>Предстоящие</h3>
          <span className="chip c-mut"><span className="d" />{upcoming.length}</span>
        </div>
        {table(upcoming, "Нет назначенных зачётов")}
      </div>

      <div className="card">
        <div className="card-h">
          <h3>Прошедшие</h3>
          <span className="chip c-mut"><span className="d" />{past.length}</span>
        </div>
        {table(past, "Зачётов ещё не было")}
      </div>
    </>
  );
}
