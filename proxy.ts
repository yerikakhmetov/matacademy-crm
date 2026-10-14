import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

// Next 16: конвенция "proxy" вместо "middleware".
// Защищает все маршруты, кроме статики и api-роутов авторизации.
export default auth;

export const config = {
  // Публичная статика без входа: логотип (/brand/…) нужен на странице входа, демо-фото
  // (/demo/…) — в портале родителя, который открывается без входа; логотип же
  // оптимизатор картинок запрашивает без cookie; иконки и манифест браузер берёт сам.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|brand/|demo/|icon.png|apple-icon.png|manifest.webmanifest).*)"],
};
