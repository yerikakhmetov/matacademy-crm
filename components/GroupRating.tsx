import { prisma } from "@/lib/prisma";
import { computeRating, type RatingRow } from "@/lib/rating";
import { schoolClock, schoolMonthStart } from "@/lib/school-time";
import { t, type Locale } from "@/lib/i18n";
import { Avatar } from "@/components/Avatar";

// Рейтинг группы за текущий месяц для кабинета ученика.
// Одногруппники видят друг у друга только фото, имя, место и очки; из чего сложились
// очки — видит только сам ученик.

export async function loadGroupRating(groupId: string, tz: number) {
  const now = schoolClock(tz);
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  // даты посещений, оценок и сроков ДЗ — UTC-полночь; время зачёта — момент, границы по часам школы
  const day = { gte: new Date(Date.UTC(y, m, 1)), lt: new Date(Date.UTC(y, m + 1, 1)) };
  const moment = { gte: schoolMonthStart(y, m, tz), lt: schoolMonthStart(y, m + 1, tz) };

  const students = await prisma.student.findMany({
    where: { status: "ACTIVE", groups: { some: { id: groupId } } },
    select: { id: true, name: true, photoUrl: true },
  });
  const ids = students.map((s) => s.id);
  const [attendance, grades, homeworkDone, zachetPassed] = await Promise.all([
    prisma.attendance.findMany({
      where: { studentId: { in: ids }, date: day, lesson: { groupId } },
      select: { studentId: true, present: true },
    }),
    prisma.grade.findMany({ where: { studentId: { in: ids }, groupId, date: day }, select: { studentId: true, score: true, maxScore: true } }),
    prisma.homeworkDone.findMany({
      where: {
        studentId: { in: ids },
        done: true,
        homework: { groupId, OR: [{ dueDate: day }, { dueDate: null, createdAt: moment }] },
      },
      select: { studentId: true },
    }),
    prisma.zachetResult.findMany({
      where: { studentId: { in: ids }, passed: true, zachet: { groupId, scheduledAt: moment } },
      select: { studentId: true },
    }),
  ]);
  const rows = computeRating({ studentIds: ids, attendance, grades, homeworkDone, zachetPassed });
  return { rows, students: new Map(students.map((s) => [s.id, s])) };
}

const PLACE_BG = ["#F5B700", "#A7B1C2", "#CD7F32"]; // золото, серебро, бронза

export function GroupRatingList({
  rows,
  students,
  meId,
  locale,
}: {
  rows: RatingRow[];
  students: Map<string, { id: string; name: string; photoUrl: string | null }>;
  meId: string;
  locale: Locale;
}) {
  const me = rows.find((r) => r.studentId === meId);
  return (
    <>
      {me && (
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-2)" }}>
          <div className="mut" style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>
            {t(locale, "rating.myPoints")}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "4px 0 8px" }}>
            <span className="kval num" style={{ fontSize: 26 }}>{me.points}</span>
            <span style={{ fontWeight: 700 }}>{t(locale, "rating.place", { n: me.place })}</span>
            <span className="mut">/ {rows.length}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(["attend", "grades", "hw", "zachet"] as const).map((k) => (
              <span key={k} className="chip c-mut" style={{ fontSize: 12 }}>
                {t(locale, `rating.${k}` as const)}: <b style={{ marginLeft: 3 }}>{me.parts[k]}</b>
              </span>
            ))}
          </div>
        </div>
      )}
      <div style={{ padding: "6px 0" }}>
        {rows.map((r) => {
          const s = students.get(r.studentId);
          if (!s) return null;
          const mine = r.studentId === meId;
          return (
            <div
              key={r.studentId}
              className="list-row"
              style={{ gap: 12, alignItems: "center", background: mine ? "var(--accent-soft)" : undefined }}
            >
              <span
                className="num"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  flex: "none",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: 13,
                  background: r.place <= 3 && r.points > 0 ? PLACE_BG[r.place - 1] : "var(--surface-2)",
                  color: r.place <= 3 && r.points > 0 ? "#fff" : "var(--ink-2)",
                }}
              >
                {r.place}
              </span>
              <Avatar name={s.name} photoUrl={s.photoUrl} size={34} radius={17} fontSize={12} />
              <div style={{ flex: 1, minWidth: 0, fontWeight: mine ? 700 : 600 }}>
                {s.name}
                {mine && <span className="mut" style={{ fontWeight: 500 }}> · {t(locale, "rating.you")}</span>}
              </div>
              <span className="num" style={{ fontWeight: 700 }}>{t(locale, "rating.points", { n: r.points })}</span>
            </div>
          );
        })}
      </div>
      <p className="mut" style={{ fontSize: 12, margin: 0, padding: "4px 18px 16px" }}>
        <b>{t(locale, "rating.how")}:</b> {t(locale, "rating.howText")}
      </p>
    </>
  );
}
