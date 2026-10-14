// Чистая арифметика зарплаты преподавателя (без БД) — покрыта тестами в payroll.test.ts.
//
// Месячная доля ученика по предмету берётся ТОЛЬКО из оплаченных счетов (monthlyFeesFromPaid):
// неоплаченный счёт зарплату не приносит, частично оплаченный — пропорционально.
// Если ученик ходил в несколько групп одного предмета, доля делится между группами
// пропорционально оплачиваемым занятиям в каждой (subjectLessonTotals).
//
// Модель: из месячной доли ученика по предмету удерживается schoolFeePct% (доход школы),
// остаток делится на число занятий группы В ЭТОМ МЕСЯЦЕ по расписанию.
// Это цена одного занятия одного ученика. Преподаватель получает её за каждое
// «оплачиваемое» посещение: присутствовал ИЛИ отсутствовал без уважительной причины.
// За отсутствие по уважительной причине за этого ученика в этот день не платят.
//
// Делитель берётся из расписания, а не из числа отметок: иначе, отметив меньше занятий,
// можно было бы увеличить цену каждого. В обычном месяце это ровно 12 (3 раза в неделю)
// или 8 (2 раза), а в месяце с пятой неделей — 15 или 10, и ученик никогда
// не «стоит» больше своей месячной доли.

export type PayrollRow = {
  teacherId: string;
  students: number; // сколько учеников принесли оплату в этом месяце
  paidLessons: number; // оплачиваемых посещений (ученико-занятий)
  studentsWithoutFee: number; // ходили, но месячная доля не найдена — деньги не начислены
  base: number; // начислено до удержания школы, ₸
  salary: number; // к выплате, ₸
  /** из чего сложилась зарплата: ученик × группа × занятия (к выплате, без округления) */
  details: PayrollDetail[];
};

export type PayrollDetail = {
  groupId: string;
  studentId: string;
  lessons: number; // оплачиваемых посещений
  amount: number; // к выплате за этого ученика в этой группе, ₸
  noFee?: boolean; // ходил, но оплаченного счёта нет — 0 ₸
};

// Оплачивается ли это посещение преподавателю.
export function isPayableAttendance(present: boolean, excused: boolean): boolean {
  return present || !excused;
}

export const payableKey = (groupId: string, studentId: string) => `${groupId}|${studentId}`;
export const feeKey = (studentId: string, subjectId: string) => `${studentId}|${subjectId}`;

// Сколько раз день недели (1=Пн … 7=Вс) встречается в месяце.
// startDate — день, с которого группа начала заниматься: занятия до него
// не проводились, поэтому в счёт не идут (иначе делитель зарплаты завышен,
// и первый месяц новой группы недоплачивается преподавателю).
export function weekdayOccurrences(
  year: number,
  month0: number,
  dayOfWeek: number,
  startDate?: Date | null
): number {
  const from = startDate
    ? Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate())
    : null;
  let count = 0;
  const d = new Date(Date.UTC(year, month0, 1));
  while (d.getUTCMonth() === month0) {
    const js = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    if (js === dayOfWeek && (from === null || d.getTime() >= from)) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

// Слот расписания во времени: activeFrom — с какого дня он действует (null — с начала группы),
// archivedAt — когда его убрали из расписания (занятия с этого момента не идут).
export type SlotSpan = { dayOfWeek: number; activeFrom?: Date | null; archivedAt?: Date | null };

const dayFloor = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

// Идёт ли занятие слота в этот день (дата — UTC-полночь). Та же логика в журнале и в зарплате,
// поэтому делитель зарплаты совпадает с числом столбцов журнала.
export function slotRunsOn(d: Date, slot: SlotSpan, startDate?: Date | null): boolean {
  const t = d.getTime();
  if (startDate && t < dayFloor(startDate)) return false;
  if (slot.activeFrom && t < dayFloor(slot.activeFrom)) return false;
  if (slot.archivedAt && t >= slot.archivedAt.getTime()) return false;
  return true;
}

// Сколько занятий у группы в месяце с учётом истории расписания: слот, убранный в октябре,
// в сентябре ещё шёл, а добавленный в октябре в сентябре не шёл. Без этого смена расписания
// задним числом меняла делитель прошлых, ещё не зафиксированных месяцев.
export function slotLessonsInMonth(year: number, month0: number, slots: SlotSpan[], startDate?: Date | null): number {
  let count = 0;
  const d = new Date(Date.UTC(year, month0, 1));
  while (d.getUTCMonth() === month0) {
    const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    for (const s of slots) if (s.dayOfWeek === dow && slotRunsOn(d, s, startDate)) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

// Сколько занятий у группы в этом месяце по расписанию.
export function scheduledLessonsInMonth(
  year: number,
  month0: number,
  dayOfWeeks: number[],
  startDate?: Date | null
): number {
  return dayOfWeeks.reduce((a, dow) => a + weekdayOccurrences(year, month0, dow, startDate), 0);
}

export type PayrollTeacher = {
  id: string;
  groups: {
    id: string;
    subjectId: string | null;
    scheduledLessons: number; // занятий в этом месяце по расписанию
    studentIds: string[];
  }[];
};

// Ставка по предмету: сумма с одного ученика за lessons занятий.
// Занятие одного ученика стоит amount / lessons и платится за каждое
// оплачиваемое посещение — независимо от того, заплатил ли ученик в этом месяце.
export type SubjectRate = { amount: number; lessons: number };

export type PayrollInput = {
  teachers: PayrollTeacher[];
  /** payableKey(groupId, studentId) -> число оплачиваемых посещений за месяц */
  payable: Map<string, number>;
  /** feeKey(studentId, subjectId) -> месячная доля ученика по предмету, ₸ */
  monthlyFee: Map<string, number>;
  /** subjectId -> ставка преподавателя; если есть, она важнее доли ученика */
  rates?: Map<string, SubjectRate>;
  /** удержание школы, % (к ставке не применяется — ставка уже «на руки») */
  feePct: number;
  /**
   * Оплата пакетами (с PACKAGE_BILLING_FROM): payableKey -> сумма цен списанных занятий
   * и сколько посещений покрыто оплатой. Если задано, заменяет «долю ÷ занятий месяца».
   */
  packaged?: Map<string, PackagedPay>;
};

export type PackagedPay = { value: number; covered: number };

// Оплаченная доля предмета по счёту. year/month0 — месяц, за который выставлен счёт.
export type PaidItem = {
  studentId: string;
  subjectId: string;
  amount: number; // доля предмета в счёте, ₸
  ratio: number; // оплаченная часть счёта, 0..1 (settledRatio)
  year: number;
  month0: number;
  months: number; // на сколько месяцев счёт
};

// Месячная доля учеников по предметам за (year, month0): feeKey -> ₸.
// Счёт на N месяцев делится поровну между N месяцами, начиная со своего.
export function monthlyFeesFromPaid(items: PaidItem[], year: number, month0: number): Map<string, number> {
  const target = year * 12 + month0;
  const fees = new Map<string, number>();
  for (const it of items) {
    const months = Math.max(1, it.months);
    const start = it.year * 12 + it.month0;
    if (target < start || target >= start + months) continue;
    const v = (it.amount * Math.max(0, Math.min(1, it.ratio))) / months;
    if (v <= 0) continue;
    const k = feeKey(it.studentId, it.subjectId);
    fees.set(k, (fees.get(k) ?? 0) + v);
  }
  return fees;
}

// Ученики группы по отметкам месяца: кто ходил, даже если сейчас уже в другой группе.
function payableStudentsByGroup(payable: Map<string, number>): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const [k, n] of payable) {
    if (n <= 0) continue;
    const [groupId, studentId] = k.split("|");
    let set = out.get(groupId);
    if (!set) out.set(groupId, (set = new Set()));
    set.add(studentId);
  }
  return out;
}

// feeKey(student, subject) -> оплачиваемых занятий по предмету во ВСЕХ группах за месяц.
// По этой сумме доля ученика делится между группами одного предмета.
export function subjectLessonTotals(
  groups: { id: string; subjectId: string | null }[],
  payable: Map<string, number>
): Map<string, number> {
  const subjectOf = new Map(groups.map((g) => [g.id, g.subjectId]));
  const totals = new Map<string, number>();
  for (const [k, n] of payable) {
    const [groupId, studentId] = k.split("|");
    const subjectId = subjectOf.get(groupId);
    if (!subjectId || n <= 0) continue;
    const fk = feeKey(studentId, subjectId);
    totals.set(fk, (totals.get(fk) ?? 0) + n);
  }
  return totals;
}

export function computePayrollRows({ teachers, payable, monthlyFee, rates, feePct, packaged }: PayrollInput): Map<string, PayrollRow> {
  const net = Math.max(0, 100 - Math.max(0, feePct)) / 100;
  const rows = new Map<string, PayrollRow>();
  const totals = subjectLessonTotals(teachers.flatMap((t) => t.groups), payable);
  const attendedByGroup = payableStudentsByGroup(payable);

  for (const t of teachers) {
    let rateGross = 0;  // по ставке предмета — выплачивается полностью
    let shareGross = 0; // по доле ученика — из неё удерживается feePct
    let paidLessons = 0;
    const studs = new Set<string>();
    const noFee = new Set<string>();
    const details: PayrollDetail[] = [];

    for (const g of t.groups) {
      if (!g.subjectId) continue;
      const rate = rates?.get(g.subjectId);
      const byRate = rate != null && rate.amount > 0 && rate.lessons > 0;
      const divisor = g.scheduledLessons;
      if (!byRate && !packaged && divisor <= 0) continue;
      // Текущий состав плюс те, кто ходил в этом месяце и уже ушёл из группы
      const ids = new Set([...g.studentIds, ...(attendedByGroup.get(g.id) ?? [])]);
      for (const studentId of ids) {
        const pl = payable.get(payableKey(g.id, studentId)) ?? 0;
        if (pl === 0) continue;
        paidLessons += pl;
        if (byRate) {
          // Ставка: цена занятия фиксирована, оплата ученика роли не играет
          const amount = (rate.amount / rate.lessons) * pl;
          rateGross += amount;
          details.push({ groupId: g.id, studentId, lessons: pl, amount });
          studs.add(studentId);
          continue;
        }
        if (packaged) {
          // Пакеты: каждое посещение уже оценено ценой списанного занятия
          const p = packaged.get(payableKey(g.id, studentId)) ?? { value: 0, covered: 0 };
          if (p.covered > 0) {
            shareGross += p.value;
            details.push({ groupId: g.id, studentId, lessons: p.covered, amount: p.value * net });
            studs.add(studentId);
          }
          if (p.covered < pl) {
            // сверх оплаченного пакета — ходил без оплаты
            noFee.add(studentId);
            details.push({ groupId: g.id, studentId, lessons: pl - p.covered, amount: 0, noFee: true });
          }
          continue;
        }
        const fee = monthlyFee.get(feeKey(studentId, g.subjectId)) ?? 0;
        if (fee <= 0) {
          noFee.add(studentId);
          details.push({ groupId: g.id, studentId, lessons: pl, amount: 0, noFee: true });
          continue;
        }
        // Ходил в несколько групп предмета — каждой группе часть доли по её занятиям.
        const total = Math.max(pl, totals.get(feeKey(studentId, g.subjectId)) ?? pl);
        const share = (fee * pl) / total;
        // С группы нельзя начислить больше её части месячной доли.
        const gross = Math.min(share, (fee / divisor) * pl);
        shareGross += gross;
        details.push({ groupId: g.id, studentId, lessons: pl, amount: gross * net });
        studs.add(studentId);
      }
    }

    rows.set(t.id, {
      teacherId: t.id,
      students: studs.size,
      paidLessons,
      studentsWithoutFee: noFee.size,
      base: Math.round(rateGross + shareGross),
      salary: Math.round(rateGross + shareGross * net),
      details,
    });
  }
  return rows;
}

// ---------- Куратор ----------
//
// Куратор не ведёт занятия, а закреплён за группами. Его зарплата считается по каждой
// группе отдельно: ставка группы × ученики этой группы, оплатившие её предмет в этом месяце.
// Две группы математики — два отдельных начисления; ученик на трёх предметах у одного
// куратора приносит три ставки. Ставка: своя у группы → у предмета → общая из настроек.
// Удержание школы не применяется: ставка уже «на руки».
// Если ученик в этом месяце ходил в несколько групп одного предмета, ставка делится
// между группами пропорционально оплачиваемым занятиям. Без отметок — целиком той
// группе, где ученик числится.

export type PayrollCurator = {
  id: string;
  /** rate — своя ставка группы, ₸ с ученика; 0/нет = ставка предмета или общая */
  groups: { id: string; subjectId: string | null; studentIds: string[]; rate?: number }[];
};

export type CuratorGroupRow = { groupId: string; subjectId: string; seats: number; rate: number; amount: number };

export type CuratorRow = {
  curatorId: string;
  seats: number; // оплаченных ученико-предметов
  students: number; // уникальных учеников
  salary: number; // ₸ к выплате
  byGroup: CuratorGroupRow[];
};

export type CuratorPayrollInput = {
  curators: PayrollCurator[];
  /** feeKey(studentId, subjectId) -> месячная доля ученика по предмету, ₸ (>0 = оплатил) */
  monthlyFee: Map<string, number>;
  /** общая ставка из настроек, ₸ с ученика за предмет */
  defaultRate: number;
  /** subjectId -> своя ставка предмета; 0/отсутствует = общая */
  subjectRates?: Map<string, number>;
  /** payableKey(groupId, studentId) -> оплачиваемых занятий за месяц, по ВСЕМ группам */
  payable?: Map<string, number>;
  /** все группы школы (для деления ставки между группами одного предмета) */
  allGroups?: { id: string; subjectId: string | null }[];
};

export function curatorRateFor(
  subjectId: string,
  defaultRate: number,
  subjectRates?: Map<string, number>,
  groupRate = 0
): number {
  if (groupRate > 0) return groupRate;
  const own = subjectRates?.get(subjectId) ?? 0;
  return Math.max(0, own > 0 ? own : defaultRate);
}

export function computeCuratorRows({
  curators,
  monthlyFee,
  defaultRate,
  subjectRates,
  payable = new Map(),
  allGroups = [],
}: CuratorPayrollInput): Map<string, CuratorRow> {
  const rows = new Map<string, CuratorRow>();
  const totals = subjectLessonTotals(allGroups, payable);
  const attendedByGroup = payableStudentsByGroup(payable);

  for (const c of curators) {
    const students = new Set<string>();
    const byGroup: CuratorGroupRow[] = [];

    for (const g of c.groups) {
      if (!g.subjectId) continue;
      const rate = curatorRateFor(g.subjectId, defaultRate, subjectRates, g.rate ?? 0);
      const members = new Set(g.studentIds);
      const ids = new Set([...g.studentIds, ...(attendedByGroup.get(g.id) ?? [])]);
      const row: CuratorGroupRow = { groupId: g.id, subjectId: g.subjectId, seats: 0, rate, amount: 0 };
      for (const studentId of ids) {
        const k = feeKey(studentId, g.subjectId);
        if ((monthlyFee.get(k) ?? 0) <= 0) continue;
        const total = totals.get(k) ?? 0;
        // Ходил в несколько групп предмета — ставка делится по занятиям в каждой.
        // Отметок нет — ставка группе, где ученик числится.
        const frac = total > 0 ? (payable.get(payableKey(g.id, studentId)) ?? 0) / total : members.has(studentId) ? 1 : 0;
        if (frac <= 0) continue;
        students.add(studentId);
        row.seats += 1;
        row.amount += rate * frac;
      }
      if (row.seats > 0) byGroup.push({ ...row, amount: Math.round(row.amount) });
    }

    rows.set(c.id, {
      curatorId: c.id,
      seats: byGroup.reduce((a, r) => a + r.seats, 0),
      students: students.size,
      salary: byGroup.reduce((a, r) => a + r.amount, 0),
      byGroup,
    });
  }
  return rows;
}
