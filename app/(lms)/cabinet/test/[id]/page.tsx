import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getStudentIdForUser } from "@/lib/teacher";
import { isTestOpen, shuffleForSeed } from "@/lib/tests";
import { getSettings } from "@/lib/settings";
import { submitTestAttempt } from "@/app/actions/data";
import { formatDate, gradeChipClass } from "@/lib/format";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export default async function CabinetTest({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ retake?: string }>;
}) {
  const { id } = await params;
  const { retake } = await searchParams;
  const session = await auth();
  const studentId = await getStudentIdForUser(session?.user?.id);
  if (!studentId) redirect("/cabinet");

  const test = await prisma.test.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" } },
      group: { include: { lessons: { select: { dayOfWeek: true, startTime: true } } } },
      subject: { select: { name: true, color: true } },
      attempts: { where: { studentId } },
    },
  });
  if (!test || !test.groupId) redirect("/cabinet");

  // Ученик должен состоять в группе теста
  const inGroup = await prisma.student.findFirst({ where: { id: studentId, groups: { some: { id: test.groupId } } }, select: { id: true } });
  if (!inGroup) redirect("/cabinet");

  const attempt = test.attempts[0] ?? null;
  const tz = (await getSettings()).tzOffsetHours;
  const open = isTestOpen(test.date, test.group?.lessons ?? [], new Date(), tz);

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <Link href="/cabinet" className="close-x" style={{ textDecoration: "none" }}>←</Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ fontSize: 20, display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: test.subject?.color ?? "#3A5AE0", flex: "none" }} />
          {test.title}
        </h1>
        <p className="mut" style={{ fontSize: 12.5, margin: "2px 0 0" }}>
          {test.subject?.name ? `${test.subject.name} · ` : ""}{test.questions.length} вопросов · макс. {test.maxScore} баллов
        </p>
      </div>
    </div>
  );

  const retaking = retake === "1" && test.allowRetake;

  // ── Результат (тест уже пройден) ──
  if (attempt && !retaking) {
    const pct = Math.round((attempt.score / test.maxScore) * 100);
    return (
      <div>
        {header}
        <div className="card" style={{ padding: 20, marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
          <div>
            <div className="mut" style={{ fontSize: 12.5 }}>Ваш результат</div>
            <div className="num" style={{ fontSize: 30, fontWeight: 800 }}>{attempt.score}<span className="mut" style={{ fontSize: 16 }}>/{test.maxScore}</span></div>
          </div>
          <span className={`chip ${gradeChipClass(pct)}`} style={{ marginLeft: "auto" }}><span className="d" />{attempt.correctCount} из {attempt.total} верно</span>
        </div>

        {test.allowRetake && (
          <div className="card" style={{ padding: 16, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <p className="mut" style={{ fontSize: 13, margin: 0, flex: 1 }}>
              Этот тест можно пройти заново — прошлый результат заменится новым.
            </p>
            <Link className="btn ghost" href={`/cabinet/test/${test.id}?retake=1`}>Пройти заново</Link>
          </div>
        )}

        {test.questions.map((q, i) => {
          const chosen = attempt.answers[i] ?? -1;
          const right = chosen === q.correct;
          return (
            <div key={q.id} className="card" style={{ padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10 }}>
                <span className={`chip ${right ? "c-ok" : "c-bad"}`} style={{ flex: "none" }}><span className="d" />{right ? "Верно" : "Ошибка"}</span>
                <div style={{ fontWeight: 600 }}>{i + 1}. {q.text}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {q.options.map((opt, oi) => {
                  const isCorrect = oi === q.correct;
                  const isChosen = oi === chosen;
                  const bg = isCorrect ? "var(--ok-soft)" : isChosen ? "var(--bad-soft)" : "transparent";
                  const bd = isCorrect ? "var(--ok)" : isChosen ? "var(--bad)" : "var(--line-2)";
                  return (
                    <div key={oi} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", borderRadius: 9, border: `1.5px solid ${bd}`, background: bg }}>
                      <span className="num" style={{ fontWeight: 700, width: 18 }}>{LETTERS[oi]}</span>
                      <span style={{ flex: 1 }}>{opt}</span>
                      {isCorrect && <Icon name="check" size={15} style={{ color: "var(--ok)" }} />}
                      {isChosen && !isCorrect && <span className="mut" style={{ fontSize: 11.5 }}>ваш ответ</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Тест ещё не открыт ──
  if (!open) {
    return (
      <div>
        {header}
        <div className="card" style={{ padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🔒</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Тест ещё не открыт</div>
          <p className="mut" style={{ fontSize: 13, margin: 0 }}>Он станет доступен после урока по расписанию ({formatDate(test.date)}).</p>
        </div>
      </div>
    );
  }

  // ── Прохождение теста ──
  return (
    <div>
      {header}
      <form action={submitTestAttempt.bind(null, test.id)}>
        {(test.shuffle ? shuffleForSeed(test.questions, `${test.id}|${studentId}`) : test.questions).map((q, i) => (
          <div key={q.id} className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>{i + 1}. {q.text}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {q.options.map((opt, oi) => (
                <label key={oi} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, border: "1.5px solid var(--line-2)", cursor: "pointer" }}>
                  <input type="radio" name={`q_${q.id}`} value={oi} />
                  <span className="num" style={{ fontWeight: 700, width: 18 }}>{LETTERS[oi]}</span>
                  <span style={{ flex: 1 }}>{opt}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        <div className="card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 12, position: "sticky", bottom: 12 }}>
          <p className="mut" style={{ fontSize: 12, margin: 0, flex: 1 }}>
            {test.allowRetake
              ? "Тест можно пройти заново — последний результат станет итоговым."
              : "Тест можно пройти один раз. Проверьте ответы перед отправкой."}
          </p>
          <button className="btn" type="submit"><Icon name="check" size={16} />Отправить</button>
        </div>
      </form>
    </div>
  );
}
