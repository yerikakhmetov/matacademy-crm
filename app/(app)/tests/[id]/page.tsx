import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData } from "@/lib/access";
import { isTeacher } from "@/lib/teacher";
import { formatDate, scoreColor } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { saveTestResults } from "@/app/actions/data";
import { hardestQuestions, questionStats } from "@/lib/test-stats";
import { DeleteTestButton } from "./DeleteTestButton";
import { SaveTestButton } from "./SaveTestButton";

export const dynamic = "force-dynamic";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export default async function TestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const teacher = isTeacher(session?.user?.role);
  const editor = await canEditData(session?.user?.role);
  const uid = session?.user?.id;

  const test = await prisma.test.findUnique({
    where: { id },
    include: {
      group: {
        include: {
          teacher: { select: { userId: true } },
          students: { orderBy: { name: "asc" }, select: { id: true, name: true, photoUrl: true } },
        },
      },
      subject: { select: { name: true, color: true, teachers: { select: { userId: true } } } },
      grades: { select: { studentId: true, score: true } },
      questions: { orderBy: { order: "asc" } },
      attempts: {
        where: { finished: true },
        include: { student: { select: { id: true, name: true } } },
        orderBy: { submittedAt: "desc" },
      },
    },
  });
  if (!test) notFound();

  // Права: админ/менеджер — всегда; преподаватель — своя группа или свой предмет
  const ownsGroup = !!test.group?.teacher?.userId && test.group.teacher.userId === uid;
  const teachesSubject = !!test.subject?.teachers.some((t) => t.userId === uid);
  if (teacher && !ownsGroup && !teachesSubject) redirect("/tests");
  const canEditResults = editor || ownsGroup;

  const scoreByStudent = new Map(test.grades.map((g) => [g.studentId, g.score]));

  // Разбор онлайн-прохождений: где группа спотыкается
  const attempts = test.attempts;
  const stats = questionStats(
    test.questions.map((q) => ({ correct: q.correct, optionsCount: q.options.length })),
    attempts.map((a) => ({ answers: a.answers }))
  );
  const hard = hardestQuestions(stats, 60);
  const students = test.group?.students ?? [];
  const entered = test.grades.length;
  const avg =
    entered > 0 ? Math.round(test.grades.reduce((a, g) => a + (g.score / test.maxScore) * 100, 0) / entered) : null;

  return (
    <>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/tests" className="close-x" style={{ textDecoration: "none" }}>
            ←
          </Link>
          <div>
            <h1 style={{ fontSize: 22, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {test.title}
              {test.subject && (
                <span className="chip" style={{ padding: "2px 9px", fontSize: 11, background: `${test.subject.color}22`, color: test.subject.color }}>
                  {test.subject.name}
                </span>
              )}
            </h1>
            <p>
              {test.group?.name ? `${test.group.name} · ` : ""}
              {formatDate(test.date)} · макс. {test.maxScore}
              {test.questions.length ? ` · ${test.questions.length} вопросов` : ""}
            </p>
          </div>
        </div>
        {(editor || ownsGroup || teachesSubject) && <DeleteTestButton id={test.id} title={test.title} />}
      </div>

      {/* Вопросы теста */}
      {test.questions.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-h">
            <h3>Вопросы</h3>
            <span className="chip c-ok" style={{ fontSize: 10.5 }}>
              <span className="d" />
              правильный ответ выделен
            </span>
          </div>
          <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 18 }}>
            {test.questions.map((q, qi) => (
              <div key={q.id}>
                <div style={{ fontWeight: 600, marginBottom: 8, display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ flex: 1, minWidth: 200 }}>{qi + 1}. {q.text}</span>
                  {attempts.length > 0 && (
                    <span
                      className={`chip ${stats[qi].correctPct >= 80 ? "c-ok" : stats[qi].correctPct >= 60 ? "c-warn" : "c-bad"}`}
                      style={{ flex: "none" }}
                    >
                      <span className="d" />
                      {stats[qi].correct} из {attempts.length} · {stats[qi].correctPct}%
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {q.options.map((opt, oi) => {
                    const correct = oi === q.correct;
                    return (
                      <div
                        key={oi}
                        style={{
                          display: "flex",
                          gap: 9,
                          alignItems: "baseline",
                          padding: "5px 10px",
                          borderRadius: 8,
                          background: correct ? "var(--ok-soft)" : "transparent",
                          color: correct ? "var(--ok)" : "var(--ink)",
                          fontWeight: correct ? 600 : 400,
                          border: `1px solid ${correct ? "var(--ok)" : "transparent"}`,
                        }}
                      >
                        <span style={{ fontWeight: 700, width: 18, flex: "none" }}>{LETTERS[oi]})</span>
                        <span style={{ flex: 1 }}>{opt}</span>
                        {attempts.length > 0 && (
                          <span className="mut num" style={{ fontSize: 12, flex: "none" }}>
                            {stats[qi].byOption[oi] ?? 0}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {attempts.length > 0 && (
        <>
          {hard.length > 0 && (
            <div className="card" style={{ padding: 18, marginBottom: 16, borderColor: "var(--warn)" }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--warn)", fontWeight: 700, marginBottom: 8 }}>
                Разобрать на уроке
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {hard.map((h) => (
                  <div key={h.index} style={{ display: "flex", gap: 9, alignItems: "baseline" }}>
                    <span className="chip c-bad" style={{ flex: "none" }}><span className="d" />{h.correctPct}%</span>
                    <span style={{ fontSize: 13.5 }}>{h.index + 1}. {test.questions[h.index]?.text}</span>
                  </div>
                ))}
              </div>
              <p className="mut" style={{ fontSize: 12, margin: "10px 0 0" }}>
                Вопросы, где верно ответили меньше 60% проходивших.
              </p>
            </div>
          )}

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-h">
              <h3>Кто как ответил</h3>
              <span className="chip c-mut"><span className="d" />{attempts.length}</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ученик</th>
                    {test.questions.map((_, qi) => (
                      <th key={qi} className="right" style={{ width: 28 }}>{qi + 1}</th>
                    ))}
                    <th className="right">Балл</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div className="person">
                          <Avatar name={a.student.name} size={26} radius={8} fontSize={10} />
                          <div className="nm" style={{ fontSize: 13 }}>{a.student.name}</div>
                        </div>
                      </td>
                      {test.questions.map((q, qi) => {
                        const choice = a.answers[qi];
                        const ok = choice === q.correct;
                        const skipped = choice == null || choice < 0;
                        return (
                          <td key={qi} className="right" title={skipped ? "Без ответа" : `Ответ: ${LETTERS[choice] ?? choice}`}>
                            <span style={{ color: skipped ? "var(--ink-3)" : ok ? "var(--ok)" : "var(--bad)", fontWeight: 700 }}>
                              {skipped ? "·" : ok ? "✓" : "✕"}
                            </span>
                          </td>
                        );
                      })}
                      <td className="right num" style={{ fontWeight: 700, color: scoreColor(Math.round((a.score / test.maxScore) * 100)) }}>
                        {a.score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mut" style={{ fontSize: 12, padding: "10px 18px 16px", margin: 0 }}>
              Наведите на клетку, чтобы увидеть выбранный вариант. «·» — вопрос пропущен.
            </p>
          </div>
        </>
      )}

      {/* Ввод баллов — только если тест привязан к группе */}
      {test.group && (
        <>
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
              <div className="klabel">Макс. балл</div>
              <div className="kval num">{test.maxScore}</div>
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
      )}

      {!test.group && test.questions.length === 0 && (
        <div className="card">
          <div className="empty">У теста нет ни группы, ни вопросов.</div>
        </div>
      )}
    </>
  );
}
