import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData } from "@/lib/access";
import { setGroupStartDates } from "@/app/actions/data";
import { DAYS, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const dateValue = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

// Массовое проставление даты первого занятия: от неё зависят журнал,
// календарь ученика и делитель зарплаты, поэтому она нужна каждой группе.
export default async function GroupStartDatesPage() {
  const session = await auth();
  if (!(await canEditData(session?.user?.role))) redirect("/groups");

  const groups = await prisma.group.findMany({
    orderBy: [{ startDate: "asc" }, { name: "asc" }],
    include: {
      subject: { select: { name: true } },
      teacher: { select: { name: true } },
      lessons: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      _count: { select: { students: true } },
    },
  });
  const missing = groups.filter((g) => g.startDate == null).length;

  return (
    <>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/groups" className="close-x" style={{ textDecoration: "none" }}>←</Link>
          <div>
            <h1>Даты начала занятий</h1>
            <p>
              {groups.length} групп · {missing > 0 ? `${missing} без даты` : "у всех есть дата"}
            </p>
          </div>
        </div>
      </div>

      <form action={setGroupStartDates}>
        <div className="card">
          <div className="card-h">
            <h3>Первое занятие группы</h3>
            {missing > 0 && <span className="chip c-bad"><span className="d" />{missing}</span>}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Группа</th>
                  <th>Расписание</th>
                  <th className="right">Учеников</th>
                  <th>Сейчас</th>
                  <th style={{ width: 190 }}>Занятия начинаются с</th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 && (
                  <tr>
                    <td colSpan={5}><div className="empty">Групп пока нет</div></td>
                  </tr>
                )}
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <Link href={`/groups/${g.id}`} style={{ color: "inherit", fontWeight: 600 }}>{g.name}</Link>
                      <div className="mut" style={{ fontSize: 11.5 }}>
                        {[g.subject?.name, g.teacher?.name].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </td>
                    <td className="mut" style={{ fontSize: 12.5 }}>
                      {g.lessons.length === 0
                        ? "не задано"
                        : g.lessons.map((l) => `${DAYS[l.dayOfWeek]} ${l.startTime}`).join(" · ")}
                    </td>
                    <td className="right num">{g._count.students}</td>
                    <td>
                      {g.startDate ? (
                        <span className="chip c-ok"><span className="d" />{formatDate(g.startDate)}</span>
                      ) : (
                        <span className="chip c-bad"><span className="d" />нет даты</span>
                      )}
                    </td>
                    <td>
                      <input type="date" name={`start_${g.id}`} defaultValue={dateValue(g.startDate)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="modal-f" style={{ borderTop: "1px solid var(--line-2)" }}>
            <span className="mut" style={{ marginRight: "auto", fontSize: 12.5 }}>
              Пустое поле не меняет уже заданную дату. От даты зависят журнал, календарь ученика и расчёт зарплаты.
            </span>
            <button className="btn" type="submit">Сохранить даты</button>
          </div>
        </div>
      </form>
    </>
  );
}
