// Привести все телефоны в базе к виду +7 (XXX) XXX-XX-XX.
// Запускается один раз после выката нормализации: новые записи сохраняются
// уже приведёнными, а старые лежат кто как — и из-за этого, в частности,
// не срабатывала скидка «брат/сестра» (родитель ищется по точному совпадению).
//
// Сначала посмотреть, что изменится (ничего не пишет):
//   DATABASE_URL="..." DIRECT_URL="..." npx tsx scripts/normalize-phones.ts
// Затем применить:
//   DATABASE_URL="..." DIRECT_URL="..." npx tsx scripts/normalize-phones.ts --apply

import { PrismaClient } from "@prisma/client";
import { normalizePhoneOrNull } from "../lib/phone";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

type Row = { id: string; name: string; phone: string | null; parentPhone?: string | null };

function plan(rows: Row[], field: "phone" | "parentPhone") {
  const out: { id: string; name: string; from: string; to: string }[] = [];
  for (const r of rows) {
    const cur = (field === "phone" ? r.phone : r.parentPhone) ?? null;
    if (!cur) continue;
    const next = normalizePhoneOrNull(cur);
    if (next && next !== cur) out.push({ id: r.id, name: r.name, from: cur, to: next });
  }
  return out;
}

async function main() {
  const [students, teachers, leads] = await Promise.all([
    prisma.student.findMany({ select: { id: true, name: true, phone: true, parentPhone: true } }),
    prisma.teacher.findMany({ select: { id: true, name: true, phone: true } }),
    prisma.lead.findMany({ select: { id: true, name: true, phone: true } }),
  ]);

  const jobs = [
    { label: "Ученик · телефон", field: "phone" as const, rows: plan(students, "phone"), table: "student" as const },
    { label: "Ученик · телефон родителя", field: "parentPhone" as const, rows: plan(students, "parentPhone"), table: "student" as const },
    { label: "Преподаватель", field: "phone" as const, rows: plan(teachers, "phone"), table: "teacher" as const },
    { label: "Лид", field: "phone" as const, rows: plan(leads, "phone"), table: "lead" as const },
  ];

  let total = 0;
  for (const j of jobs) {
    if (j.rows.length === 0) continue;
    console.log(`\n${j.label}: ${j.rows.length}`);
    for (const r of j.rows) console.log(`  ${r.name}: ${r.from}  →  ${r.to}`);
    total += j.rows.length;
    if (apply) {
      for (const r of j.rows) {
        // ключ поля не собираем динамически: Prisma проверяет форму объекта по типу
        if (j.table === "student") {
          await prisma.student.update({
            where: { id: r.id },
            data: j.field === "phone" ? { phone: r.to } : { parentPhone: r.to },
          });
        } else if (j.table === "teacher") {
          await prisma.teacher.update({ where: { id: r.id }, data: { phone: r.to } });
        } else {
          await prisma.lead.update({ where: { id: r.id }, data: { phone: r.to } });
        }
      }
    }
  }

  if (total === 0) console.log("Все телефоны уже в едином виде.");
  else if (apply) console.log(`\nОбновлено записей: ${total}`);
  else console.log(`\nБудет обновлено: ${total}. Запустите с --apply, чтобы применить.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
