// Восстановление удалённого ученика из точки во времени (Neon restore branch).
//
// Зачем: удаление ученика каскадом уносит оплаты, абонемент, посещаемость,
// оценки, домашние работы, попытки тестов и отработки. Вернуть их можно только
// из снимка базы «до» удаления.
//
// Как пользоваться:
//   1. В Neon создайте ветку, восстановленную на момент ДО удаления.
//   2. Запустите сначала без --apply (покажет, что будет восстановлено):
//      node scripts/restore-student.mjs --name "Омарбек Ерсін" \
//        --from "<connection string ветки>" --to "<connection string продакшна>"
//   3. Убедились — повторите с --apply.
//
// Скрипт идемпотентный: уже существующие записи пропускаются, повторный запуск
// ничего не ломает. Все id сохраняются, поэтому связи остаются прежними.

import { PrismaClient } from "@prisma/client";

const args = process.argv.slice(2);
const arg = (k) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const APPLY = args.includes("--apply");
const NAME = arg("--name");
const ID = arg("--id");
const FROM = arg("--from") ?? process.env.SOURCE_DATABASE_URL;
const TO = arg("--to") ?? process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL;

if (!FROM || !TO || (!NAME && !ID)) {
  console.error(`Использование:
  node scripts/restore-student.mjs --name "Имя Фамилия" --from "<url ветки>" --to "<url продакшна>" [--apply]
  node scripts/restore-student.mjs --id <id ученика> --from ... --to ... [--apply]`);
  process.exit(1);
}

const src = new PrismaClient({ datasources: { db: { url: FROM } } });
const dst = new PrismaClient({ datasources: { db: { url: TO } } });

const log = [];
const note = (s) => { log.push(s); console.log(s); };

// Переносим строки, пропуская те, чьи «родители» в целевой базе уже не существуют:
// например оценка за удалённый тест или посещаемость удалённого занятия.
async function copy(label, rows, model, checks = {}) {
  if (rows.length === 0) { note(`  ${label}: нет записей`); return; }
  let ok = 0, skipped = 0, exists = 0;
  for (const row of rows) {
    const already = await dst[model].findUnique({ where: { id: row.id }, select: { id: true } });
    if (already) { exists++; continue; }
    let miss = null;
    for (const [field, target] of Object.entries(checks)) {
      const v = row[field];
      if (v == null) continue;
      const found = await dst[target].findUnique({ where: { id: v }, select: { id: true } });
      if (!found) { miss = `${field}=${v} (${target})`; break; }
    }
    if (miss) { skipped++; note(`    пропуск ${row.id}: нет ${miss}`); continue; }
    if (APPLY) await dst[model].create({ data: row });
    ok++;
  }
  note(`  ${label}: восстановить ${ok}, уже есть ${exists}, пропущено ${skipped}`);
}

async function main() {
  const where = ID ? { id: ID } : { name: NAME };
  const found = await src.student.findMany({ where, include: { groups: { select: { id: true, name: true } } } });
  if (found.length === 0) throw new Error("В снимке такой ученик не найден — проверьте имя или момент восстановления");
  if (found.length > 1) throw new Error(`Найдено ${found.length} учеников с таким именем — укажите --id (${found.map((s) => s.id).join(", ")})`);

  const [student] = found;
  const { groups, ...scalars } = student;
  note(`Ученик: ${student.name} (${student.id})`);
  note(`Группы в снимке: ${groups.map((g) => g.name).join(", ") || "нет"}`);

  const sid = student.id;
  const [subs, subItems, payments, payItems, payTxs, attendance, grades, hwDone, attempts, makeups] =
    await Promise.all([
      src.subscription.findMany({ where: { studentId: sid } }),
      src.subscriptionItem.findMany({ where: { subscription: { studentId: sid } } }),
      src.payment.findMany({ where: { studentId: sid } }),
      src.paymentItem.findMany({ where: { payment: { studentId: sid } } }),
      src.paymentTx.findMany({ where: { payment: { studentId: sid } } }),
      src.attendance.findMany({ where: { studentId: sid } }),
      src.grade.findMany({ where: { studentId: sid } }),
      src.homeworkDone.findMany({ where: { studentId: sid } }),
      src.testAttempt.findMany({ where: { studentId: sid } }),
      src.makeup.findMany({ where: { studentId: sid } }),
    ]);

  note(APPLY ? "\n=== ВОССТАНОВЛЕНИЕ ===" : "\n=== ПРОВЕРКА (без записи, добавьте --apply) ===");

  const already = await dst.student.findUnique({ where: { id: sid }, select: { id: true } });
  if (already) note("  Ученик: уже есть в базе");
  else {
    if (APPLY) await dst.student.create({ data: scalars });
    note("  Ученик: восстановить 1");
  }

  // Группы: подключаем только те, что ещё существуют
  const liveGroups = [];
  for (const g of groups) {
    const f = await dst.group.findUnique({ where: { id: g.id }, select: { id: true } });
    if (f) liveGroups.push(g);
    else note(`    группа «${g.name}» больше не существует — пропуск`);
  }
  if (APPLY && liveGroups.length > 0) {
    await dst.student.update({ where: { id: sid }, data: { groups: { connect: liveGroups.map((g) => ({ id: g.id })) } } });
  }
  note(`  Группы: подключить ${liveGroups.length}`);

  await copy("Абонементы", subs, "subscription");
  await copy("Предметы абонемента", subItems, "subscriptionItem", { subscriptionId: "subscription", subjectId: "subject" });
  await copy("Счета (оплаты)", payments, "payment");
  await copy("Предметы счёта", payItems, "paymentItem", { paymentId: "payment", subjectId: "subject" });
  await copy("Движения денег", payTxs, "paymentTx", { paymentId: "payment" });
  await copy("Посещаемость", attendance, "attendance", { lessonId: "lesson" });
  await copy("Оценки", grades, "grade", { groupId: "group", testId: "test" });
  await copy("Домашние работы", hwDone, "homeworkDone", { homeworkId: "homework" });
  await copy("Попытки тестов", attempts, "testAttempt", { testId: "test" });
  await copy("Отработки", makeups, "makeup", { lessonId: "lesson" });

  note(APPLY ? "\nГотово. Проверьте карточку ученика в CRM." : "\nЗаписи не менялись. Повторите с --apply, чтобы восстановить.");
}

main()
  .catch((e) => { console.error("\nОшибка:", e.message); process.exitCode = 1; })
  .finally(async () => { await src.$disconnect(); await dst.$disconnect(); });
