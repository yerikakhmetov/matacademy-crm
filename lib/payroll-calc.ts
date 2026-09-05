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
export function weekdayOccurrences(year: number, month0: number, dayOfWeek: number): number {
  let count = 0;
  const d = new Date(Date.UTC(year, month0, 1));
  while (d.getUTCMonth() === month0) {
    const js = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    if (js === dayOfWeek) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

// Сколько занятий у группы в этом месяце по расписанию.
export function scheduledLessonsInMonth(year: number, month0: number, dayOfWeeks: number[]): number {
  return dayOfWeeks.reduce((a, dow) => a + weekdayOccurrences(year, month0, dow), 0);
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

export type PayrollInput = {
  teachers: PayrollTeacher[];
  /** payableKey(groupId, studentId) -> число оплачиваемых посещений за месяц */
  payable: Map<string, number>;
  /** feeKey(studentId, subjectId) -> месячная доля ученика по предмету, ₸ */
  monthlyFee: Map<string, number>;
  /** удержание школы, % */
  feePct: number;
};

export function computePayrollRows({ teachers, payable, monthlyFee, feePct }: PayrollInput): Map<string, PayrollRow> {
  const net = Math.max(0, 100 - Math.max(0, feePct)) / 100;
  const rows = new Map<string, PayrollRow>();

  for (const t of teachers) {
    let gross = 0;
    let paidLessons = 0;
    const studs = new Set<string>();
    const noFee = new Set<string>();

    for (const g of t.groups) {
      const divisor = g.scheduledLessons;
      if (divisor <= 0 || !g.subjectId) continue;
      for (const studentId of g.studentIds) {
        const pl = payable.get(payableKey(g.id, studentId)) ?? 0;
        if (pl === 0) continue;
        paidLessons += pl;
        const fee = monthlyFee.get(feeKey(studentId, g.subjectId)) ?? 0;
        if (fee <= 0) {
          noFee.add(studentId);
          continue;
        }
        // За месяц с ученика нельзя начислить больше его месячной доли.
        gross += Math.min(fee, (fee / divisor) * pl);
        studs.add(studentId);
      }
    }

    rows.set(t.id, {
      teacherId: t.id,
      students: studs.size,
      paidLessons,
      studentsWithoutFee: noFee.size,
      base: Math.round(gross),
      salary: Math.round(gross * net),
    });
  }
  return rows;
}
