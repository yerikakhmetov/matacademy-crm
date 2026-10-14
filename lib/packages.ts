// Оплата пакетами занятий. «Месяц обучения» — это не календарный месяц, а пакет:
// 12 занятий (выборный предмет) или 8 (обязательный). Счёт на N месяцев даёт
// N × пакет занятий по каждому предмету; каждое оплачиваемое посещение (был или
// пропустил без уважительной причины) списывает одно занятие — сначала из самого
// старого счёта. Пропуск по уважительной причине не списывает — пакет «растягивается».
// Преподаватель получает за списанное занятие его цену: доля предмета ÷ занятий в счёте.
// Посещение без оплаченного занятия — «без оплаты», за него не начисляется.
//
// Чистые функции, покрыты тестами в packages.test.ts.

// С какого месяца зарплата считается по пакетам. Раньше — по календарным месяцам
// (доля ученика ÷ занятий группы в месяце); те месяцы не пересчитываются.
export const PACKAGE_BILLING_FROM = { year: 2026, month0: 9 }; // октябрь 2026
export const packageBillingStart = () => new Date(Date.UTC(PACKAGE_BILLING_FROM.year, PACKAGE_BILLING_FROM.month0, 1));

// Если у предмета не указано число занятий в месяце — считаем стандартный пакет.
export const DEFAULT_PACKAGE_LESSONS = 12;

export const packageLessons = (lessonsPerMonth: number | null | undefined) =>
  lessonsPerMonth && lessonsPerMonth > 0 ? lessonsPerMonth : DEFAULT_PACKAGE_LESSONS;

// Строка счёта по предмету, уже приведённая к занятиям.
export type Credit = {
  paymentId: string;
  studentId: string;
  subjectId: string;
  lessons: number; // сколько оплаченных занятий даёт эта строка
  value: number; // цена одного занятия, ₸
  order: number; // порядок списания: дата счёта (мс), раньше — раньше
};

// Строка счёта → оплаченные занятия. Частичная оплата даёт только оплаченную часть
// занятий (по полной цене каждое): 12 150 из 24 300 — это 6 занятий из 12.
// skipMonths — сколько месяцев счёта уже прошли до перехода на пакеты (старые
// календарные счета): их занятия считаются израсходованными.
export function creditFromItem(p: {
  paymentId: string;
  studentId: string;
  subjectId: string;
  itemAmount: number;
  months: number;
  lessonsPerMonth: number;
  ratio: number; // оплаченная часть счёта 0..1
  order: number;
  skipMonths?: number;
}): Credit | null {
  const months = Math.max(1, p.months);
  const total = months * packageLessons(p.lessonsPerMonth);
  if (p.itemAmount <= 0 || total <= 0) return null;
  const value = p.itemAmount / total;
  const paid = Math.floor(total * Math.max(0, Math.min(1, p.ratio)) + 1e-9);
  const skipped = Math.min(months, Math.max(0, p.skipMonths ?? 0)) * packageLessons(p.lessonsPerMonth);
  const lessons = Math.max(0, paid - skipped);
  if (lessons <= 0) return null;
  return { paymentId: p.paymentId, studentId: p.studentId, subjectId: p.subjectId, lessons, value, order: p.order };
}

export type Visit = {
  studentId: string;
  subjectId: string;
  groupId: string;
  date: Date;
};

export type Allocated = Visit & { value: number; paymentId: string | null };

const key = (studentId: string, subjectId: string) => `${studentId}|${subjectId}`;

// Списание занятий: посещения (только оплачиваемые) по дате, счета — по order.
// Возвращает каждое посещение с ценой (0 и paymentId=null — оплаченных занятий не осталось).
export function allocateVisits(credits: Credit[], visits: Visit[]): Allocated[] {
  const pools = new Map<string, { c: Credit; left: number }[]>();
  for (const c of [...credits].sort((a, b) => a.order - b.order || a.paymentId.localeCompare(b.paymentId))) {
    const k = key(c.studentId, c.subjectId);
    let list = pools.get(k);
    if (!list) pools.set(k, (list = []));
    list.push({ c, left: c.lessons });
  }
  const out: Allocated[] = [];
  for (const v of [...visits].sort((a, b) => a.date.getTime() - b.date.getTime() || a.groupId.localeCompare(b.groupId))) {
    const list = pools.get(key(v.studentId, v.subjectId));
    const slot = list?.find((x) => x.left > 0);
    if (slot) {
      slot.left -= 1;
      out.push({ ...v, value: slot.c.value, paymentId: slot.c.paymentId });
    } else {
      out.push({ ...v, value: 0, paymentId: null });
    }
  }
  return out;
}

// Остаток оплаченных занятий: key(student, subject) -> { left, total, unpaid }.
// unpaid — посещения сверх оплаченного (ходил без оплаты).
export type LessonsLeft = { left: number; total: number; unpaid: number };
export function lessonsLeft(credits: Credit[], visits: Visit[]): Map<string, LessonsLeft> {
  const res = new Map<string, LessonsLeft>();
  for (const c of credits) {
    const k = key(c.studentId, c.subjectId);
    const r = res.get(k) ?? { left: 0, total: 0, unpaid: 0 };
    r.total += c.lessons;
    r.left += c.lessons;
    res.set(k, r);
  }
  for (const a of allocateVisits(credits, visits)) {
    const k = key(a.studentId, a.subjectId);
    const r = res.get(k) ?? { left: 0, total: 0, unpaid: 0 };
    if (a.paymentId) r.left -= 1;
    else r.unpaid += 1;
    res.set(k, r);
  }
  return res;
}
export const leftKey = key;

// «1-й месяц», «2–3-й месяцы» — подпись счёта по номеру месяца обучения.
export function studyMonthLabel(first: number, months: number): string {
  const n = Math.max(1, months);
  return n === 1 ? `${first}-й месяц` : `${first}–${first + n - 1}-й месяцы`;
}

// Следующий месяц обучения ученика: после самого позднего из уже выставленных.
// Старые календарные счета тоже считаются: кто учился сентябрь и октябрь,
// получит следующим «3-й месяц», а не «1-й».
export function nextStudyMonth(invoices: { studyMonth: number | null; months: number }[]): number {
  let last = 0;
  let legacy = 0;
  for (const p of invoices) {
    if (p.studyMonth != null) last = Math.max(last, p.studyMonth + Math.max(1, p.months) - 1);
    else legacy += Math.max(1, p.months);
  }
  return Math.max(last, legacy) + 1;
}

// Кому пора напомнить об оплате следующего месяца обучения: по предметам, на которые
// ученик сейчас ходит, осталось ≤ threshold оплаченных занятий или он уже ходит без оплаты.
// Если по предмету уже выставлен неоплаченный счёт — он и так в списке «ожидают оплаты».
// Но если ученик уже ходит без оплаты, напоминаем всё равно: открытый счёт мог быть
// старым забытым, а занятия идут неоплаченными.
export const PACKAGE_ALERT_THRESHOLD = 2;
export type PackageAlertItem = { subjectId: string; left: number; unpaid: number; total: number };

export function packageAlerts(
  enrolled: { studentId: string; subjectId: string }[],
  left: Map<string, LessonsLeft>,
  openInvoice: Set<string>, // leftKey(student, subject) с неоплаченным счётом
  threshold = PACKAGE_ALERT_THRESHOLD
): Map<string, PackageAlertItem[]> {
  const out = new Map<string, PackageAlertItem[]>();
  const seen = new Set<string>();
  for (const e of enrolled) {
    const k = key(e.studentId, e.subjectId);
    if (seen.has(k)) continue;
    seen.add(k);
    const info = left.get(k) ?? { left: 0, total: 0, unpaid: 0 };
    if (openInvoice.has(k) && info.unpaid === 0) continue;
    const ending = info.unpaid > 0 || (info.total > 0 && info.left <= threshold);
    if (!ending) continue;
    const list = out.get(e.studentId) ?? [];
    list.push({ subjectId: e.subjectId, left: Math.max(0, info.left), unpaid: info.unpaid, total: info.total });
    out.set(e.studentId, list);
  }
  return out;
}
