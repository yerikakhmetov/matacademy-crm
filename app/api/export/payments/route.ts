import { auth } from "@/auth";
import { getAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";
import { PAYMENT_STATUS } from "@/lib/format";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (!(await getAccess()).can("finance")) return new Response("Forbidden", { status: 403 });

  const payments = await prisma.payment.findMany({
    include: { student: true },
    orderBy: { date: "desc" },
  });

  const csv = toCsv(
    ["Ученик", "Назначение", "Способ", "Дата", "Статус", "Сумма (₸)"],
    payments.map((p) => [
      p.student.name,
      p.purpose,
      p.method ?? "",
      p.date.toISOString().slice(0, 10),
      PAYMENT_STATUS[p.status]?.label ?? p.status,
      p.amount,
    ])
  );

  const date = new Date().toISOString().slice(0, 10);
  return csvResponse(`oplaty_${date}.csv`, csv);
}
