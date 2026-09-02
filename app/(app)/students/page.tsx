import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData, getAccess } from "@/lib/access";
import { isTeacher } from "@/lib/teacher";
import { money, initials, avatarColor, STUDENT_STATUS } from "@/lib/format";
import { ModalButton } from "@/components/ModalButton";
import { StudentForm } from "./StudentForm";
import { Icon } from "@/components/Icon";
import { createStudent } from "@/app/actions/data";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "Все" },
  { key: "ACTIVE", label: "Активные" },
  { key: "PAUSED", label: "На паузе" },
  { key: "debt", label: "Должники" },
];

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "all" } = await searchParams;
  const session = await auth();
  if (isTeacher(session?.user?.role)) redirect("/dashboard");
  const editor = await canEditData(session?.user?.role);
  const showMoney = (await getAccess()).can("finance");
  const filters = showMoney ? FILTERS : FILTERS.filter((f) => f.key !== "debt");

  const where =
    status === "debt" ? { balance: { lt: 0 } } : status === "all" ? {} : { status };

  const [students, groups, counts] = await Promise.all([
    prisma.student.findMany({ where, include: { groups: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.group.findMany({ orderBy: { name: "asc" } }),
    prisma.student.count(),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ученики</h1>
          <p>Всего {counts} · показано {students.length}</p>
        </div>
        {editor && (
          <ModalButton label="Новый ученик" title="Новый ученик" action={createStudent}>
            <StudentForm groups={groups} />
          </ModalButton>
        )}
      </div>

      <div className="toolbar">
        <div className="seg">
          {filters.map((f) => (
            <Link key={f.key} href={`/students?status=${f.key}`} className={status === f.key ? "on" : ""}>
              {f.label}
            </Link>
          ))}
        </div>
        <div className="spacer" />
        <div className="filter">
          <Icon name="export" size={15} />
          Экспорт
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ученик</th>
                <th>Класс</th>
                <th>Группа</th>
                <th>Посещаемость</th>
                <th>Статус</th>
                {showMoney && <th className="right">Баланс</th>}
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr>
                  <td colSpan={showMoney ? 6 : 5}>
                    <div className="empty">Нет учеников по этому фильтру</div>
                  </td>
                </tr>
              )}
              {students.map((s) => {
                const st = STUDENT_STATUS[s.status] ?? STUDENT_STATUS.ACTIVE;
                const att = s.attendance;
                const attC = att == null ? "var(--ink-3)" : att >= 85 ? "var(--ok)" : att >= 70 ? "var(--warn)" : "var(--bad)";
                return (
                  <tr className="clk" key={s.id}>
                    <td style={{ padding: 0 }}>
                      <Link href={`/students/${s.id}`} style={{ display: "block", padding: "12px 18px" }}>
                        <div className="person">
                          <div className="av2" style={{ background: avatarColor(s.name) }}>
                            {initials(s.name)}
                          </div>
                          <div>
                            <div className="nm">{s.name}</div>
                            <div className="sub">{s.parentName ? `Родитель: ${s.parentName}` : "Без контакта"}</div>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="mut">{s.grade ?? "—"}</td>
                    <td>{s.groups.length ? s.groups.map((g) => g.name).join(", ") : <span className="mut">Без группы</span>}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="bar" style={{ width: 60 }}>
                          <span style={{ width: `${att ?? 0}%`, background: attC }} />
                        </div>
                        <span className="num" style={{ fontSize: 12, color: attC, fontWeight: 700 }}>
                          {att == null ? "—" : `${att}%`}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`chip ${st.cls}`}>
                        <span className="d" />
                        {st.label}
                      </span>
                    </td>
                    {showMoney && (
                      <td className="right money num" style={{ color: s.balance < 0 ? "var(--bad)" : "var(--ink-3)" }}>
                        {s.balance < 0 ? money(s.balance) : "0 ₸"}
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
