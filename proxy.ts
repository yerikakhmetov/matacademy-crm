import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

// Next 16: конвенция "proxy" вместо "middleware".
// Защищает все маршруты, кроме статики и api-роутов авторизации.
export default auth;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
