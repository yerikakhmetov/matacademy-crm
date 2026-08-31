import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData } from "@/lib/access";
import { isTeacher } from "@/lib/teacher";
import { formatDate, scoreColor } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { saveTestResults } from "@/app/actions/data";
import { DeleteTestButton } from "./DeleteTestButton";
import { SaveTestButton } from "./SaveTestButton";

export const dynamic = "force-dynamic";

export default async function TestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const teacher = isTeacher(session?.user?.role);
  const editor = await canEditData(session?.user?.role);

  const test = await prisma.test.findUnique({
    where: { id },
    include: {
      group: {
        include: {
          teacher: { select: { userId: true } },
          students: { orderBy: { name: "asc" }, select: { id: true, name: true, photoUrl: true } },
        },
      },
      grades: { select: { studentId: true, score: true } },
    },
  });
  if (!test) notFound();

  // Права: админ/менеджер — всегда; преподаватель — только своя группа
  const ownsGroup = test.group.teacher?.userId === session?.user?.id;
  if (teacher && !ownsGroup) redirect("/tests");
  const canEditResults = editor || (teacher && ownsGroup);

  const scoreByStudent = new Map(test.grades.map((g) => [g.studentId, g.score]));
  const students = test.group.students;
  const entered = test.grades.length;
  const avg =
    entered > 0 ? Math.round(test.grades.reduce((a, g) => a + (g.score / test.maxScore) * 100, 0) / entered) : null;
  const best = entered > 0 ? Math.max(...test.grades.map((g) => g.score)) : null;

  return (
    <>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/tests" className="close-x" style={{ textDecoration: "none" }}>
            ←
          </Link>
          <div>
            <h1 style={{ fontSize: 22 }}>{test.title}</h1>
            <p>
              {test.group.name} · {formatDate(test.date)} · макс. {test.maxScore}
            </p>
          </div>
        </div>
        {canEditResults && <DeleteTestButton id={test.id} title={test.title} />}
      </div>

      <div className="grid kpis" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 16 }}>
        <div className="card kpi">
          <div className="klabel">Введено</div>
          <div className="kval num">
            {entered}/{students.length}
          </div>
        </div>
        <div className="card kpi">
          <div className="klabel">Средний</div>
          <div className="kval num" style={{ color: avg != null ? scoreColor(avg) : "var(--ink-3)" }}>
            {avg != null ? `${avg}%` : "—"}
          </div>
        </div>
        <div className="card kpi">
          <div className="klabel">Лучший балл</div>
          <div className="kval num">
            {best != null ? `${best}/${test.maxScore}` : "—"}
          </div>
        </div>
      </div>

      <form action={saveTestResults.bind(null, test.id)}>
        <div className="card">
          <div className="card-h">
            <h3>Баллы учеников</h3>
            <span className="chip c-mut">
              <span className="d" />
              {students.length} учеников
            </span>
          </div>
          <div style={{ padding: "6px 0" }}>
            {students.length === 0 && <div className="empty">В группе нет учеников</div>}
            {students.map((s) => {
              const cur = scoreByStudent.get(s.id);
              const pct = cur != null ? Math.round((cur / test.maxScore) * 100) : null;
              return (
                <div className="list-row" key={s.id}>
                  <Avatar name={s.name} photoUrl={s.photoUrl} size={34} radius={9} fontSize={12} />
                  <div style={{ flex: 1, fontWeight: 600 }}>{s.name}</div>
                  {pct != null && (
                    <span className="num" style={{ fontSize: 12.5, fontWeight: 700, color: scoreColor(pct), width: 46, textAlign: "right" }}>
                      {pct}%
                    </span>
                  )}
                  <input
                    name={`score_${s.id}`}
                    type="number"
                    min={0}
                    max={test.maxScore}
                    defaultValue={cur ?? ""}
                    placeholder="—"
                    disabled={!canEditResults}
                    style={{ width: 90, textAlign: "center" }}
                    aria-label={`Балл ${s.name}`}
                  />
                  <span className="mut" style={{ fontSize: 12, width: 40 }}>/ {test.maxScore}</span>
                </div>
              );
            })}
          </div>
        </div>
        {canEditResults && students.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <SaveTestButton />
            <span className="mut" style={{ fontSize: 12, marginLeft: 12 }}>
              Пустое поле — оценка не выставлена (или будет удалена).
            </span>
          </div>
        )}
      </form>
    </>
  );
}
