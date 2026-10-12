// Чистая арифметика зарплаты преподавателя (без БД) — покрыта тестами в payroll.test.ts.
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
};

export function computePayrollRows({ teachers, payable, monthlyFee, rates, feePct }: PayrollInput): Map<string, PayrollRow> {
  const net = Math.max(0, 100 - Math.max(0, feePct)) / 100;
  const rows = new Map<string, PayrollRow>();

  for (const t of teachers) {
    let rateGross = 0;  // по ставке предмета — выплачивается полностью
    let shareGross = 0; // по доле ученика — из неё удерживается feePct
    let paidLessons = 0;
    const studs = new Set<string>();
    const noFee = new Set<string>();

    for (const g of t.groups) {
      if (!g.subjectId) continue;
      const rate = rates?.get(g.subjectId);
      const byRate = rate != null && rate.amount > 0 && rate.lessons > 0;
      const divisor = g.scheduledLessons;
      if (!byRate && divisor <= 0) continue;
      for (const studentId of g.studentIds) {
        const pl = payable.get(payableKey(g.id, studentId)) ?? 0;
        if (pl === 0) continue;
        paidLessons += pl;
        if (byRate) {
          // Ставка: цена занятия фиксирована, оплата ученика роли не играет
          rateGross += (rate.amount / rate.lessons) * pl;
          studs.add(studentId);
          continue;
        }
        const fee = monthlyFee.get(feeKey(studentId, g.subjectId)) ?? 0;
        if (fee <= 0) {
          noFee.add(studentId);
          continue;
        }
        // За месяц с ученика нельзя начислить больше его месячной доли.
        shareGross += Math.min(fee, (fee / divisor) * pl);
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
    });
  }
  return rows;
}

// ---------- Куратор ----------
//
// Куратор не ведёт занятия, а закреплён за группами. Его зарплата — фиксированная
// ставка с каждого ученика, который в этом месяце оплатил предмет группы куратора.
// Ученик, ходящий на три предмета к одному куратору, приносит ему три ставки.
// Удержание школы не применяется: ставка уже «на руки». Посещаемость роли не играет.

export type PayrollCurator = {
  id: string;
  groups: { id: string; subjectId: string | null; studentIds: string[] }[];
};

export type CuratorSubjectRow = { subjectId: string; seats: number; rate: number; amount: number };

export type CuratorRow = {
  curatorId: string;
  seats: number; // оплаченных ученико-предметов
  students: number; // уникальных учеников
  salary: number; // ₸ к выплате
  bySubject: CuratorSubjectRow[];
};

export type CuratorPayrollInput = {
  curators: PayrollCurator[];
  /** feeKey(studentId, subjectId) -> месячная доля ученика по предмету, ₸ (>0 = оплатил) */
  monthlyFee: Map<string, number>;
  /** общая ставка из настроек, ₸ с ученика за предмет */
  defaultRate: number;
  /** subjectId -> своя ставка предмета; 0/отсутствует = общая */
  subjectRates?: Map<string, number>;
};

export function curatorRateFor(subjectId: string, defaultRate: number, subjectRates?: Map<string, number>): number {
  const own = subjectRates?.get(subjectId) ?? 0;
  return Math.max(0, own > 0 ? own : defaultRate);
}

export function computeCuratorRows({ curators, monthlyFee, defaultRate, subjectRates }: CuratorPayrollInput): Map<string, CuratorRow> {
  const rows = new Map<string, CuratorRow>();
  for (const c of curators) {
    const students = new Set<string>();
    // Ученик в двух группах одного предмета у одного куратора — одна ставка, не две
    const seen = new Set<string>();
    const bySubject = new Map<string, CuratorSubjectRow>();

    for (const g of c.groups) {
      if (!g.subjectId) continue;
      const rate = curatorRateFor(g.subjectId, defaultRate, subjectRates);
      for (const studentId of g.studentIds) {
        const k = feeKey(studentId, g.subjectId);
        if ((monthlyFee.get(k) ?? 0) <= 0 || seen.has(k)) continue;
        seen.add(k);
        students.add(studentId);
        let row = bySubject.get(g.subjectId);
        if (!row) bySubject.set(g.subjectId, (row = { subjectId: g.subjectId, seats: 0, rate, amount: 0 }));
        row.seats += 1;
        row.amount += rate;
      }
    }

    const list = [...bySubject.values()];
    rows.set(c.id, {
      curatorId: c.id,
      seats: list.reduce((a, r) => a + r.seats, 0),
      students: students.size,
      salary: Math.round(list.reduce((a, r) => a + r.amount, 0)),
      bySubject: list,
    });
  }
  return rows;
}
