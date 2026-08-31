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
  const uid = session?.user?.id ?? "__none__";
  const myTeacherId = teacher ? await getTeacherIdForUser(session?.user?.id) : null;

  const [tests, groups, subjects] = await Promise.all([
    prisma.test.findMany({
      where: teacher
        ? { OR: [{ group: { teacherId: myTeacherId ?? "__none__" } }, { subject: { teachers: { some: { userId: uid } } } }] }
        : {},
      include: {
        group: { select: { name: true, _count: { select: { students: true } } } },
        subject: { select: { name: true, color: true } },
        grades: { select: { score: true, maxScore: true } },
        _count: { select: { questions: true } },
      },
      orderBy: { date: "desc" },
    }),
    prisma.group.findMany({
      where: teacher ? { teacher: { userId: uid } } : {},
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.subject.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const canCreate = editor || teacher;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Тесты и контрольные</h1>
          <p>{tests.length} тестов · вопросы и ввод баллов группы</p>
        </div>
        {canCreate && (
          <ModalButton label="Новый тест" title="Новый тест" action={createTest} submitLabel="Создать">
            <TestForm groups={groups} subjects={subjects} />
          </ModalButton>
        )}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Тест</th>
                <th>Предмет</th>
                <th>Группа</th>
                <th>Дата</th>
                <th className="right">Вопросы</th>
                <th className="right">Введено</th>
                <th className="right">Средний</th>
              </tr>
            </thead>
            <tbody>
              {tests.length === 0 && (
                <tr>
                  <td colSpan={7}>
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
                    <td>
                      {t.subject ? (
                        <span className="chip" style={{ padding: "1px 8px", fontSize: 10.5, background: `${t.subject.color}22`, color: t.subject.color }}>
                          {t.subject.name}
                        </span>
                      ) : (
                        <span className="mut">—</span>
                      )}
                    </td>
                    <td className="mut">{t.group?.name ?? "—"}</td>
                    <td className="mut">{formatDate(t.date)}</td>
                    <td className="right num">{t._count.questions || "—"}</td>
                    <td className="right num">{t.group ? `${n}/${t.group._count.students}` : "—"}</td>
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
