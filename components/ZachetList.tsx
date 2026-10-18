import { t, type Locale } from "@/lib/i18n";
import { utcToSchoolParts, zachetStatus, type ZachetStatus } from "@/lib/zachet";

// Зачёты ученика — для портала родителя и кабинета ученика: тема, когда, итог.
const CHIP: Record<ZachetStatus, string> = { passed: "c-ok", failed: "c-bad", upcoming: "c-mut", pending: "c-warn" };

export function ZachetList({
  rows,
  tz,
  locale,
}: {
  rows: { id: string; topic: string; scheduledAt: Date; groupName: string; result: { passed: boolean } | null }[];
  tz: number;
  locale: Locale;
}) {
  if (rows.length === 0) return <div className="empty">{t(locale, "zachet.empty")}</div>;
  return (
    <>
      {rows.map((z) => {
        const st = zachetStatus(z.scheduledAt, z.result);
        const p = utcToSchoolParts(z.scheduledAt, tz);
        return (
          <div key={z.id} className="list-row" style={{ alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{z.topic}</div>
              <div className="mut" style={{ fontSize: 12 }}>
                {z.groupName} · {p.date.slice(8, 10)}.{p.date.slice(5, 7)} · {p.time}
              </div>
            </div>
            <span className={`chip ${CHIP[st]}`} style={{ flex: "none" }}>
              <span className="d" />
              {t(locale, `zachet.${st}` as const)}
            </span>
          </div>
        );
      })}
    </>
  );
}
