import { money } from "@/lib/format";
import type { CuratorSubjectRow } from "@/lib/payroll-calc";
import { MonthSelect } from "../payroll/PayrollControls";

type MonthRow = { id: string; name: string; salary: number; seats: number; students: number; bySubject: CuratorSubjectRow[] };

// Страница «Моя зарплата» для куратора: ставка × оплатившие ученико-предметы.
export function CuratorSalary({
  months,
  monthOpts,
  selId,
  defaultRate,
  subjectNames,
}: {
  months: MonthRow[];
  monthOpts: { id: string; name: string }[];
  selId: string;
  defaultRate: number;
  subjectNames: Record<string, string>;
}) {
  const cur = months.find((m) => m.id === selId) ?? months[0];
  const histMax = Math.max(1, ...months.map((h) => h.salary));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Моя зарплата</h1>
          <p>Расчёт куратора за {cur.name}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600 }}>К выплате за месяц</div>
          <div className="kval num" style={{ fontSize: 26, color: cur.salary > 0 ? "var(--ok)" : "var(--ink-3)" }}>{money(cur.salary)}</div>
        </div>
      </div>

      <div className="toolbar">
        <MonthSelect months={monthOpts} month={selId} path="/my-salary" />
        <span className="proto-note">Ставка {money(defaultRate)} с ученика за предмет</span>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-h"><h3>Как рассчитано</h3></div>
          <div style={{ padding: 18 }}>
            <dl className="dl">
              <dt>Учеников с оплатой</dt>
              <dd>{cur.students}</dd>
              <dt>Оплаченных предметов</dt>
              <dd>{cur.seats}</dd>
              {cur.bySubject.map((b) => (
                <div key={b.subjectId} style={{ display: "contents" }}>
                  <dt style={{ paddingLeft: 12 }}>{subjectNames[b.subjectId] ?? "—"}</dt>
                  <dd className="num">{b.seats} уч. · {money(b.amount)}</dd>
                </div>
              ))}
              <dt>К выплате</dt>
              <dd style={{ fontWeight: 800, color: "var(--ok)" }}>{money(cur.salary)}</dd>
            </dl>
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Последние 6 месяцев</h3></div>
          <div className="funnel" style={{ padding: 14 }}>
            {months.map((h) => (
              <div className="frow" key={h.id}>
                <div className="fl" style={{ width: 90 }}>{h.name}</div>
                <div className="ftrack">
                  <div className="ffill" style={{ width: `${Math.round((h.salary / histMax) * 100)}%`, background: "var(--ok)" }} />
                </div>
                <div className="fv num" style={{ width: 100 }}>{money(h.salary)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mut" style={{ fontSize: 12.5, marginTop: 14 }}>
        За каждого ученика ваших групп, оплатившего предмет в этом месяце, начисляется ставка предмета.
        Ученик с несколькими предметами приносит ставку за каждый. Если ученик в этом месяце ходил в несколько
        групп одного предмета, ставка делится между группами по числу занятий.
      </p>
    </>
  );
}
