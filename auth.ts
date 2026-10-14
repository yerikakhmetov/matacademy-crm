import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";
import { LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS } from "@/lib/login-guard";

// Вход временно закрыт: authenticate() показывает отдельное сообщение по code
class TooManyAttempts extends CredentialsSignin {
  code = "locked";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        // Подбор пароля: считаем неудачи по email (и для несуществующих — чтобы не выдавать, есть ли такой)
        const since = new Date(Date.now() - LOGIN_WINDOW_MS);
        const failures = await prisma.loginFailure.count({ where: { email, createdAt: { gte: since } } });
        if (failures >= LOGIN_MAX_FAILURES) throw new TooManyAttempts();

        const user = await prisma.user.findUnique({ where: { email } });
        const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
        if (!user || !valid) {
          await prisma.loginFailure.create({ data: { email } });
          // старые записи не копим: суток хватает с запасом
          await prisma.loginFailure.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86_400_000) } } });
          return null;
        }
        await prisma.loginFailure.deleteMany({ where: { email } });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
    // Вход через бота Telegram (одноразовый токен)
    Credentials({
      id: "telegram",
      name: "Telegram",
      credentials: { token: {} },
      async authorize(raw) {
        const token = String((raw as { token?: string })?.token ?? "");
        if (!token) return null;
        const lt = await prisma.loginToken.findUnique({ where: { token } });
        // токен действителен 10 минут и должен быть подтверждён вебхуком (userId заполнен)
        if (!lt?.userId || Date.now() - lt.createdAt.getTime() > 10 * 60 * 1000) return null;
        const user = await prisma.user.findUnique({ where: { id: lt.userId } });
        await prisma.loginToken.delete({ where: { token } }).catch(() => {});
        if (!user) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
});
