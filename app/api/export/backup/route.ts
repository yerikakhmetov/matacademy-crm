import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Полная выгрузка данных школы одним JSON — на случай, если нужно забрать всё
// из облака или перенести. Только администратор.
//
// Намеренно НЕ выгружаются: хеши паролей и одноразовые токены входа —
// файл скачивается на компьютер, и такие данные в нём быть не должны.
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return new Response("Forbidden", { status: 403 });

  const [
    settings, users, teachers, subjects, groups, students, lessons, lessonSessions,
    attendance, makeups, homework, homeworkDone, grades, tests, testQuestions, testAttempts,
    subscriptions, subscriptionItems, payments, paymentItems, paymentTxs, promoCodes,
    expenses, leads, leadActivities, materials, payrollRecords,
  ] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "main" } }),
    prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, telegramUserId: true, createdAt: true } }),
    prisma.teacher.findMany(),
    prisma.subject.findMany(),
    prisma.group.findMany(),
    prisma.student.findMany({ include: { groups: { select: { id: true } } } }),
    prisma.lesson.findMany(),
    prisma.lessonSession.findMany(),
    prisma.attendance.findMany(),
    prisma.makeup.findMany(),
    prisma.homework.findMany(),
    prisma.homeworkDone.findMany(),
    prisma.grade.findMany(),
    prisma.test.findMany(),
    prisma.testQuestion.findMany(),
    prisma.testAttempt.findMany(),
    prisma.subscription.findMany(),
    prisma.subscriptionItem.findMany(),
    prisma.payment.findMany(),
    prisma.paymentItem.findMany(),
    prisma.paymentTx.findMany(),
    prisma.promoCode.findMany(),
    prisma.expense.findMany(),
    prisma.lead.findMany(),
    prisma.leadActivity.findMany(),
    prisma.material.findMany(),
    prisma.payrollRecord.findMany(),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    exportedBy: session.user?.name ?? null,
    note: "Резервная копия МатАкадемии. Пароли и токены входа не выгружаются.",
    data: {
      settings, users, teachers, subjects, groups, students, lessons, lessonSessions,
      attendance, makeups, homework, homeworkDone, grades, tests, testQuestions, testAttempts,
      subscriptions, subscriptionItems, payments, paymentItems, paymentTxs, promoCodes,
      expenses, leads, leadActivities, materials, payrollRecords,
    },
  };

  await logAudit("CREATE", "Резервная копия", `Выгрузка данных · ${users.length} пользователей, ${students.length} учеников`);

  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="matacademy_backup_${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
