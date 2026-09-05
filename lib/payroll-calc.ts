// Единая логика зарплаты преподавателя (по посещаемости).
//
// Модель: из месячной доли ученика по предмету удерживается schoolFeePct% (доход школы),
// остаток делится на (занятий в неделю × 4). Это цена одного занятия одного ученика.
// Преподаватель получает её за каждое «оплачиваемое» посещение:
//   присутствовал ИЛИ отсутствовал без уважительной причины.
// За отсутствие по уважительной причине за этого ученика в этот день не платят.

export type PayrollRow = {
  teacherId: string;
  students: number; // сколько учеников принесли оплату в этом месяце
  paidLessons: number; // оплачиваемых посещений (ученико-занятий)
  base: number; // начислено до удержания школы, ₸
  salary: number; // к выплате, ₸
};

// Оплачивается ли это посещение преподавателю.
export function isPayableAttendance(present: boolean, excused: boolean): boolean {
  return present || !excused;
}

export const payableKey = (groupId: string, studentId: string) => `${groupId}|${studentId}`;
export const feeKey = (studentId: string, subjectId: string) => `${studentId}|${subjectId}`;

export type PayrollTeacher = {
  id: string;
  groups: {
    id: string;
    subjectId: string | null;
    lessonsPerWeek: number;
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

// Чистый расчёт (без БД) — вся денежная арифметика живёт здесь и покрыта тестами.
export function computePayrollRows({ teachers, payable, monthlyFee, feePct }: PayrollInput): Map<string, PayrollRow> {
  const net = Math.max(0, 100 - Math.max(0, feePct)) / 100;
  const rows = new Map<string, PayrollRow>();

  for (const t of teachers) {
    let gross = 0;
    let paidLessons = 0;
    const studs = new Set<string>();

    for (const g of t.groups) {
      const divisor = g.lessonsPerWeek * 4; // занятий в неделю × 4
      if (divisor === 0 || !g.subjectId) continue;
      for (const studentId of g.studentIds) {
        const pl = payable.get(payableKey(g.id, studentId)) ?? 0;
        if (pl === 0) continue;
        const fee = monthlyFee.get(feeKey(studentId, g.subjectId)) ?? 0;
        gross += (fee / divisor) * pl;
        paidLessons += pl;
        studs.add(studentId);
      }
    }

    rows.set(t.id, {
      teacherId: t.id,
      students: studs.size,
      paidLessons,
      base: Math.round(gross),
      salary: Math.round(gross * net),
    });
  }
  return rows;
}
