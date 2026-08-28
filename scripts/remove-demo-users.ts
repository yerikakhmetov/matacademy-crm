// Удалить демо-аккаунты (admin/manager/teacher @matacademy.kz).
// ВАЖНО: сначала создайте своего пользователя-администратора (scripts/set-password.ts),
// иначе не сможете войти.
//
// Запуск (против Neon — подставьте строку подключения):
//   DATABASE_URL="..." DIRECT_URL="..." npx tsx scripts/remove-demo-users.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_EMAILS = ["admin@matacademy.kz", "manager@matacademy.kz", "teacher@matacademy.kz"];

async function main() {
  const remaining = await prisma.user.count({ where: { email: { notIn: DEMO_EMAILS } } });
  if (remaining === 0) {
    console.error("❌ Нельзя удалить демо-аккаунты: других пользователей нет. Сначала создайте своего админа:");
    console.error('   npx tsx scripts/set-password.ts you@school.kz "ваш_пароль" ADMIN "Ваше Имя"');
    process.exit(1);
  }
  const res = await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
  console.log(`✅ Удалено демо-аккаунтов: ${res.count}. Осталось пользователей: ${remaining}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
