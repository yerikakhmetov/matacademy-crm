import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

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

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

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
