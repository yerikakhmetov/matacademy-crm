import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData, requireAccess } from "@/lib/access";
import { money, formatDate, EXPENSE_CATEGORY } from "@/lib/format";
import { ModalButton } from "@/components/ModalButton";
import { MonthSelect } from "../payroll/PayrollControls";
import { ExpenseForm } from "./ExpenseForm";
import { DeleteExpenseButton } from "./DeleteExpenseButton";
import { createExpense, updateExpense } from "@/app/actions/data";

export const dynamic = "force-dynamic";

const MONTH_NAMES = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  await requireAccess("finance");
  const session = await auth();
  const editor = await canEditData(session?.user?.role);

  const now = new Date();
  const monthOpts = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { id: `${d.getFullYear()}-${d.getMonth()}`, name: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`, year: d.getFullYear(), month0: d.getMonth() };
  });
  const sel = (sp.month && monthOpts.find((m) => m.id === sp.month)) || monthOpts[0];
  const monthStart = new Date(sel.year, sel.month0, 1);
  const monthEnd = new Date(sel.year, sel.month0 + 1, 1);

  const expenses = await prisma.expense.findMany({
    where: { date: { gte: monthStart, lt: monthEnd } },
    orderBy: { date: "desc" },
  });

  const total = expenses.reduce((a, e) => a + e.amount, 0);
  const byCategory = new Map<string, number>();
  for (const e of expenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  const cats = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Расходы школы</h1>
          <p>Аренда, коммунальные, реклама и прочее — вычитаются из прибыли в отчётах</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600 }}>
              Расходы за месяц
            </div>
            <div className="kval num" style={{ fontSize: 26, color: total > 0 ? "var(--bad)" : "var(--ink-3)" }}>{money(total)}</div>
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
        {cats.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginLeft: "auto" }}>
            {cats.map(([c, sum]) => (
              <span key={c} className="chip c-mut">
                <span className="d" />
                {EXPENSE_CATEGORY[c] ?? c}: {money(sum)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
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
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={editor ? 6 : 5}>
                    <div className="empty">За этот месяц расходов не внесено</div>
                  </td>
                </tr>
              )}
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{e.title}</div>
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
        Прибыль в «Отчётах» считается как доход − фонд зарплаты − расходы за месяц.
      </p>
    </>
  );
}
