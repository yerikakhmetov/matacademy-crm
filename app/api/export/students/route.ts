import { auth } from "@/auth";
import { getAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";
import { STUDENT_STATUS } from "@/lib/format";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (!(await getAccess()).can("finance")) return new Response("Forbidden", { status: 403 });

  const students = await prisma.student.findMany({
    include: { groups: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  const csv = toCsv(
    ["Имя", "Класс", "Группа", "Статус", "Телефон", "Родитель", "Тел. родителя", "Посещаемость %", "Баланс (₸)"],
    students.map((s) => [
      s.name,
      s.grade ?? "",
      s.groups.map((g) => g.name).join(", "),
      STUDENT_STATUS[s.status]?.label ?? s.status,
      s.phone ?? "",
      s.parentName ?? "",
      s.parentPhone ?? "",
      s.attendance ?? "",
      s.balance,
    ])
  );

  const date = new Date().toISOString().slice(0, 10);
  return csvResponse(`ucheniki_${date}.csv`, csv);
}
