"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { gatherPayroll } from "@/lib/payroll";
import { assertEditor } from "./_shared";

// ---------- Зарплата ----------
// Снимок расчёта за месяц, чтобы прошлые месяцы не пересчитывались при изменении ставок/состава.
export async function lockPayrollMonth(year: number, month0: number) {
  await assertEditor("payroll");
  const settings = await getSettings();
  const feePct = settings.schoolFeePct;
  const rows = await gatherPayroll(year, month0, feePct);

  const session = await auth();
  for (const [teacherId, r] of rows) {
    await prisma.payrollRecord.upsert({
      where: { teacherId_year_month: { teacherId, year, month: month0 } },
      create: { teacherId, year, month: month0, rate: feePct, rateType: "ATTENDANCE", base: r.base, salary: r.salary, createdBy: session?.user?.name ?? null },
      update: { rate: feePct, rateType: "ATTENDANCE", base: r.base, salary: r.salary, createdBy: session?.user?.name ?? null },
    });
  }
  await logAudit("UPDATE", "Зарплата", `Зафиксирован месяц ${month0 + 1}.${year}`);
  revalidatePath("/payroll");
}

export async function unlockPayrollMonth(year: number, month0: number) {
  await assertEditor("payroll");
  await prisma.payrollRecord.deleteMany({ where: { year, month: month0 } });
  await logAudit("UPDATE", "Зарплата", `Снята фиксация месяца ${month0 + 1}.${year}`);
  revalidatePath("/payroll");
}
