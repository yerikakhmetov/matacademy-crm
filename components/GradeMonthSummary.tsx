import { prisma } from "@/lib/prisma";
import { gradeChipClass, gradeMonthSummary } from "@/lib/format";
import { gradeTypeLabel, t, type Locale } from "@/lib/i18n";
import { schoolClock } from "@/lib/school-time";

// Итоги текущего месяца по видам оценок — для портала родителя и кабинета ученика:
// «Домашние задания 75% · 4 оц.», «Контрольные 68% · 2 оц.».
export async function GradeMonthSummary({ studentId, tz, locale }: { studentId: string; tz: number; locale: Locale }) {
  const now = schoolClock(tz);
  const year = now.getUTCFullYear();
  const month0 = now.getUTCMonth();
  // даты оценок — UTC-полночь, границы месяца тоже по UTC
  const grades = await prisma.grade.findMany({
    where: { studentId, date: { gte: new Date(Date.UTC(year, month0, 1)), lt: new Date(Date.UTC(year, month0 + 1, 1)) } },
    select: { type: true, score: true, maxScore: true, date: true },
  });
  const rows = gradeMonthSummary(grades, year, month0);

  return (
    <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line-2)" }}>
      <div className="mut" style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>
        {t(locale, "grade.thisMonth")}
      </div>
      {rows.length === 0 ? (
        <div className="mut" style={{ fontSize: 13 }}>{t(locale, "grade.noneThisMonth")}</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {rows.map((r) => (
            <span key={r.type} className={`chip ${gradeChipClass(r.avg)}`} style={{ fontSize: 12.5 }}>
              <span className="d" />
              {gradeTypeLabel(locale, r.type, true)}: <b style={{ marginLeft: 3 }}>{r.avg}%</b>
              <span style={{ opacity: 0.7, marginLeft: 4 }}>· {t(locale, "grade.count", { n: r.count })}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
