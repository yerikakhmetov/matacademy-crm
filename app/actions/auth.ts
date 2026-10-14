"use server";

import { signIn, signOut } from "@/auth";
import { AuthError, CredentialsSignin } from "next-auth";
import { LOGIN_WINDOW_MS } from "@/lib/login-guard";

export async function authenticate(_prev: string | undefined, formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof CredentialsSignin && error.code === "locked") {
      return `Слишком много неудачных попыток. Попробуйте через ${LOGIN_WINDOW_MS / 60_000} минут`;
    }
    if (error instanceof AuthError) {
      return "Неверный email или пароль";
    }
    throw error;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
