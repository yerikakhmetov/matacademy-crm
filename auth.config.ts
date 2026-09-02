import type { NextAuthConfig } from "next-auth";

// Edge-совместимая часть конфигурации (используется в middleware).
// Никаких обращений к БД или bcrypt здесь быть не должно.
export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [], // провайдеры добавляются в auth.ts (Node runtime)
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      // Публичные маршруты: вход, родительский портал по токену и приглашение ученика
      if (pathname.startsWith("/login") || pathname.startsWith("/p/") || pathname.startsWith("/join/")) return true;
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) token.role = (user as { role?: string }).role ?? "MANAGER";
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = (token.role as string) ?? "MANAGER";
        (session.user as { id?: string }).id = token.sub as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
