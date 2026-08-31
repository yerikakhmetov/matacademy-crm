import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData } from "@/lib/access";
import { isTeacher, getTeacherIdForUser } from "@/lib/teacher";
import { formatDate, scoreColor } from "@/lib/format";
import { ModalButton } from "@/components/ModalButton";
import { TestForm } from "./TestForm";
import { createTest } from "@/app/actions/data";

export const dynamic = "force-dynamic";

export default async function TestsPage() {
  const session = await auth();
  const teacher = isTeacher(session?.user?.role);
  const editor = await canEditData(session?.user?.role);
  const myTeacherId = teacher ? await getTeacherIdForUser(session?.user?.id) : null;

  const groupWhere = teacher ? { teacher: { userId: session?.user?.id ?? "__none__" } } : {};

  const [tests, groups] = await Promise.all([
    prisma.test.findMany({
      where: teacher ? { group: { teacherId: myTeacherId ?? "__none__" } } : {},
      include: {
        group: { select: { name: true, _count: { select: { students: true } } } },
        grades: { select: { score: true, maxScore: true } },
      },
      orderBy: { date: "desc" },
    }),
    prisma.group.findMany({ where: groupWhere, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const canCreate = (editor || teacher) && groups.length > 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Тесты и контрольные</h1>
          <p>{tests.length} тестов · баллы группы вводятся на одном экране</p>
        </div>
        {canCreate && (
          <ModalButton label="Новый тест" title="Новый тест" action={createTest} submitLabel="Создать и ввести баллы">
            <TestForm groups={groups} />
          </ModalButton>
        )}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Тест</th>
                <th>Группа</th>
                <th>Дата</th>
                <th className="right">Введено</th>
                <th className="right">Средний</th>
              </tr>
            </thead>
            <tbody>
              {tests.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty">Тестов пока нет{canCreate ? " — создайте первый" : ""}</div>
                  </td>
                </tr>
              )}
              {tests.map((t) => {
                const n = t.grades.length;
                const avg = n > 0 ? Math.round(t.grades.reduce((a, g) => a + (g.score / g.maxScore) * 100, 0) / n) : null;
                return (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/tests/${t.id}`} className="ln" style={{ fontWeight: 600 }}>
                        {t.title}
                      </Link>
                      <div className="mut" style={{ fontSize: 11.5 }}>макс. {t.maxScore}</div>
                    </td>
                    <td className="mut">{t.group.name}</td>
                    <td className="mut">{formatDate(t.date)}</td>
                    <td className="right num">
                      {n}/{t.group._count.students}
                    </td>
                    <td className="right num" style={{ fontWeight: 700, color: avg != null ? scoreColor(avg) : "var(--ink-3)" }}>
                      {avg != null ? `${avg}%` : "—"}
                    </td>
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
