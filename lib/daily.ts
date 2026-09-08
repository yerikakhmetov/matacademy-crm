// Группировка движений денег по дням.
// День считается по часовому поясу школы: оплата, принятая вечером,
// не должна попадать в предыдущий день из-за UTC.

export type DayTx = { kind: string; amount: number; date: Date };

export type DayGroup<T extends DayTx> = {
  day: string; // YYYY-MM-DD в часовом поясе школы
  income: number; // приходы
  refund: number; // возвраты
  net: number; // приходы − возвраты
  count: number; // сколько движений
  items: T[];
};

export function dayKeyInTz(d: Date, tzOffsetHours: number): string {
  return new Date(d.getTime() + tzOffsetHours * 3600_000).toISOString().slice(0, 10);
}

// Дни идут от новых к старым; внутри дня — тоже новые сверху.
export function groupByDay<T extends DayTx>(txs: T[], tzOffsetHours: number): DayGroup<T>[] {
  const map = new Map<string, DayGroup<T>>();
  for (const tx of txs) {
    const day = dayKeyInTz(tx.date, tzOffsetHours);
    let g = map.get(day);
    if (!g) map.set(day, (g = { day, income: 0, refund: 0, net: 0, count: 0, items: [] }));
    if (tx.kind === "REFUND") {
      g.refund += tx.amount;
      g.net -= tx.amount;
    } else {
      g.income += tx.amount;
      g.net += tx.amount;
    }
    g.count++;
    g.items.push(tx);
  }
  const groups = [...map.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
  for (const g of groups) g.items.sort((a, b) => b.date.getTime() - a.date.getTime());
  return groups;
}
