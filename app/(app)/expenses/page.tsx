import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData, requireAccess } from "@/lib/access";
import { money, formatDate } from "@/lib/format";
import { EXPENSE_CATEGORY, categorySummary, recurringToCopy } from "@/lib/expenses";
import { getSettings } from "@/lib/settings";
import { lastSchoolMonths } from "@/lib/school-time";
import { ModalButton } from "@/components/ModalButton";
import { MonthSelect } from "../payroll/PayrollControls";
import { ExpenseForm } from "./ExpenseForm";
import { DeleteExpenseButton } from "./DeleteExpenseButton";
import { copyRecurringExpenses, createExpense, updateExpense } from "@/app/actions/expenses";
import { cardCols } from "@/lib/card-table";

export const dynamic = "force-dynamic";

const MONTH_NAMES = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ month?: string; cat?: string }> }) {
  const sp = await searchParams;
  await requireAccess("finance");
  const session = await auth();
  const editor = await canEditData(session?.user?.role);

  // месяцы — по часам школы; даты расходов хранятся UTC-полночью
  const tz = (await getSettings()).tzOffsetHours;
  const monthOpts = lastSchoolMonths(12, tz)
    .reverse()
    .map((m) => ({ id: m.key, name: `${MONTH_NAMES[m.month0]} ${m.year}`, year: m.year, month0: m.month0 }));
  const sel = (sp.month && monthOpts.find((m) => m.id === sp.month)) || monthOpts[0];
  const monthStart = new Date(Date.UTC(sel.year, sel.month0, 1));
  const monthEnd = new Date(Date.UTC(sel.year, sel.month0 + 1, 1));
  const prevStart = new Date(Date.UTC(sel.year, sel.month0 - 1, 1));
  const cat = sp.cat && sp.cat in EXPENSE_CATEGORY ? sp.cat : null;

  const [expenses, prevExpenses] = await Promise.all([
    prisma.expense.findMany({ where: { date: { gte: monthStart, lt: monthEnd } }, orderBy: { date: "desc" } }),
    prisma.expense.findMany({ where: { date: { gte: prevStart, lt: monthStart } } }),
  ]);

  const total = expenses.reduce((a, e) => a + e.amount, 0);
  const prevTotal = prevExpenses.reduce((a, e) => a + e.amount, 0);
  const summary = categorySummary(expenses, prevExpenses);
  const maxSum = Math.max(1, ...summary.map((r) => Math.max(r.sum, r.prev)));
  const toCopy = recurringToCopy(prevExpenses, expenses);
  const shown = cat ? expenses.filter((e) => e.category === cat) : expenses;
  const prevName = MONTH_NAMES[(sel.month0 + 11) % 12];
  const href = (c: string | null) => `/expenses?month=${sel.id}${c ? `&cat=${c}` : ""}`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Расходы школы</h1>
          <p>Аренда, коммунальные, маркетинг, канцелярия и прочее — вычитаются из прибыли в отчётах</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ textAlign: "right" }}>
            <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600 }}>
              Расходы за месяц
            </div>
            <div className="kval num" style={{ fontSize: 26, color: total > 0 ? "var(--bad)" : "var(--ink-3)" }}>{money(total)}</div>
            {prevTotal > 0 && (
              <div className="mut" style={{ fontSize: 12 }}>
                {prevName}: {money(prevTotal)}
              </div>
            )}
          </div>
          {editor && (
            <ModalButton label="Добавить расход" title="Новый расход" icon="money" action={createExpense}>
              <ExpenseForm />
            </ModalButton>
          )}
        </div>
      </div>

      <div className="toolbar">
        <MonthSelect months={monthOpts} month={sel.id} path="/expenses" />
        {editor && toCopy.length > 0 && (
          <form action={copyRecurringExpenses.bind(null, sel.year, sel.month0)}>
            <button type="submit" className="btn ghost" title={toCopy.map((e) => `${e.title} — ${money(e.amount)}`).join("\n")}>
              Перенести ежемесячные из {prevName} ({toCopy.length}, {money(toCopy.reduce((a, e) => a + e.amount, 0))})
            </button>
          </form>
        )}
      </div>

      {summary.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-h">
            <h3>По категориям</h3>
            <span className="mut" style={{ fontSize: 12 }}>серым — {prevName}</span>
          </div>
          <div style={{ padding: "4px 18px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {summary.map((r) => {
              const diff = r.sum - r.prev;
              return (
                <Link key={r.key} href={href(cat === r.key ? null : r.key)} style={{ color: "inherit", textDecoration: "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                    <span style={{ fontWeight: cat === r.key ? 800 : 600 }}>
                      {EXPENSE_CATEGORY[r.key] ?? r.key}
                      {r.share > 0 && <span className="mut" style={{ fontWeight: 500 }}> · {r.share}%</span>}
                    </span>
                    <span className="num" style={{ whiteSpace: "nowrap" }}>
                      <b>{money(r.sum)}</b>
                      {r.prev > 0 && diff !== 0 && (
                        <span style={{ marginLeft: 6, fontSize: 11.5, color: diff > 0 ? "var(--bad)" : "var(--ok)" }}>
                          {diff > 0 ? "▲" : "▼"} {money(Math.abs(diff))}
                        </span>
                      )}
                    </span>
                  </div>
                  <div style={{ position: "relative", height: 8, marginTop: 5, borderRadius: 4, background: "var(--surface-2)" }}>
                    <span style={{ position: "absolute", inset: 0, width: `${(r.prev / maxSum) * 100}%`, borderRadius: 4, background: "var(--line)" }} />
                    <span style={{ position: "absolute", inset: 0, width: `${(r.sum / maxSum) * 100}%`, borderRadius: 4, background: "var(--bad)", opacity: 0.75 }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {cat && (
        <div className="toolbar">
          <span className="chip c-warn">
            <span className="d" />
            {EXPENSE_CATEGORY[cat]}: {money(shown.reduce((a, e) => a + e.amount, 0))}
          </span>
          <Link href={href(null)} className="link" style={{ fontSize: 13 }}>Показать все</Link>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table {...cardCols(["За что", "Категория", "Дата", "Кто внёс", "Сумма", editor && ""])}>
            <thead>
              <tr>
                <th>За что</th>
                <th>Категория</th>
                <th>Дата</th>
                <th>Кто внёс</th>
                <th className="right">Сумма</th>
                {editor && <th></th>}
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={editor ? 6 : 5}>
                    <div className="empty">{cat ? "В этой категории за месяц расходов нет" : "За этот месяц расходов не внесено"}</div>
                  </td>
                </tr>
              )}
              {shown.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {e.title}
                      {e.recurring && (
                        <span className="chip c-mut" style={{ marginLeft: 6, fontSize: 10.5, padding: "1px 6px" }} title="Ежемесячный расход">
                          ↻ ежемес.
                        </span>
                      )}
                    </div>
                    {e.note && <div className="mut" style={{ fontSize: 12 }}>{e.note}</div>}
                  </td>
                  <td className="mut">{EXPENSE_CATEGORY[e.category] ?? e.category}</td>
                  <td className="mut">{formatDate(e.date)}</td>
                  <td className="mut">{e.createdBy ?? "—"}</td>
                  <td className="right money num">{money(e.amount)}</td>
                  {editor && (
                    <td className="right">
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <ModalButton
                          label="Изменить"
                          title={`Расход · ${e.title}`}
                          icon="edit"
                          buttonClass="btn ghost"
                          action={updateExpense.bind(null, e.id)}
                          submitLabel="Сохранить"
                        >
                          <ExpenseForm values={e} />
                        </ModalButton>
                        <DeleteExpenseButton id={e.id} />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mut" style={{ fontSize: 12.5, marginTop: 14 }}>
        Прибыль в «Отчётах» считается как доход − фонд зарплаты − расходы за месяц. Отметьте аренду, коммунальные,
        интернет «ежемесячными» — в следующем месяце их можно перенести одной кнопкой и поправить суммы.
      </p>
    </>
  );
}
