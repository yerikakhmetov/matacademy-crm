// Создать пользователя или сменить пароль.
// Запуск (локально или против Neon — подставьте строку подключения):
//   DATABASE_URL="..." DIRECT_URL="..." npx tsx scripts/set-password.ts <email> <пароль> [ADMIN|MANAGER|TEACHER] ["Имя Фамилия"]
//
// Примеры:
//   npx tsx scripts/set-password.ts director@school.kz 'СложныйПароль123' ADMIN "Айгерим Ж."
//   npx tsx scripts/set-password.ts manager@school.kz 'ДругойПароль456' MANAGER

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [email, password, role, name] = process.argv.slice(2);

  if (!email || !password) {
    console.error("Использование: tsx scripts/set-password.ts <email> <пароль> [ADMIN|MANAGER|TEACHER] [\"Имя\"]");
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("Пароль слишком короткий (минимум 6 символов).");
    process.exit(1);
  }

  const validRoles = ["ADMIN", "MANAGER", "TEACHER"];
  const finalRole = role && validRoles.includes(role) ? role : undefined;
  const passwordHash = bcrypt.hashSync(password, 10);
  const normEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normEmail } });

  if (existing) {
    await prisma.user.update({
      where: { email: normEmail },
      data: { passwordHash, ...(finalRole ? { role: finalRole } : {}), ...(name ? { name } : {}) },
    });
    console.log(`✅ Пароль обновлён для ${normEmail}${finalRole ? ` (роль: ${finalRole})` : ""}`);
  } else {
    await prisma.user.create({
      data: { email: normEmail, passwordHash, role: finalRole ?? "ADMIN", name: name ?? normEmail },
    });
    console.log(`✅ Создан пользователь ${normEmail} (роль: ${finalRole ?? "ADMIN"})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
