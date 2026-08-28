// Очистка демо-данных. Логины (User) и настройки (Settings) НЕ трогаются.
// Запуск (подставьте строку подключения Neon):
//   DATABASE_URL="..." DIRECT_URL="..." npx tsx scripts/clear.ts students   — удалить только учеников (и их оплаты/абонементы/оценки/посещаемость)
//   DATABASE_URL="..." DIRECT_URL="..." npx tsx scripts/clear.ts all         — удалить все демо-данные (ученики, группы, учителя, лиды, оплаты…)
//
// Логины и настройки школы сохраняются в обоих режимах.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const mode = process.argv[2];
  if (mode !== "students" && mode !== "all") {
    console.error("Укажите режим: students | all");
    console.error('  npx tsx scripts/clear.ts students   — только ученики');
    console.error('  npx tsx scripts/clear.ts all         — все демо-данные (кроме логинов и настроек)');
    process.exit(1);
  }

  // Ученики и всё, что к ним привязано (оплаты, абонементы, посещаемость, оценки — по каскаду)
  const s = await prisma.student.deleteMany();
  console.log(`🧹 Удалено учеников: ${s.count} (вместе с их оплатами, абонементами, оценками, посещаемостью)`);

  if (mode === "all") {
    const at = await prisma.attendance.deleteMany();
    const gr = await prisma.grade.deleteMany();
    const le = await prisma.lesson.deleteMany();
    const li = await prisma.lead.deleteMany(); // активности лидов — по каскаду
    const gp = await prisma.group.deleteMany();
    const tc = await prisma.teacher.deleteMany();
    const au = await prisma.auditLog.deleteMany();
    console.log(`🧹 Занятия: ${le.count} · Группы: ${gp.count} · Учителя: ${tc.count} · Лиды: ${li.count} · Журнал: ${au.count}`);
    void at;
    void gr;
  }

  const users = await prisma.user.count();
  console.log(`✅ Готово. Логинов сохранено: ${users}. Настройки школы сохранены.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
