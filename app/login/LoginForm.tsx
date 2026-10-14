"use client";

import { useActionState } from "react";
import { authenticate } from "@/app/actions/auth";
import { BrandMark } from "@/components/BrandMark";
import { TelegramLoginButton } from "./TelegramLoginButton";

export function LoginForm({ botUsername }: { botUsername?: string | null }) {
  const [error, formAction, pending] = useActionState(authenticate, undefined);

  return (
    <div className="login-wrap">
      <form className="login-card" action={formAction}>
        <div style={{ marginBottom: 18 }}>
          <BrandMark size={64} />
        </div>
        <h1>Вход в CRM</h1>
        <p>МатАкадемия · система управления школой</p>

        {error && <div className="err">{error}</div>}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" placeholder="you@matacademy.kz" required autoComplete="username" />
        </div>
        <div className="field">
          <label htmlFor="password">Пароль</label>
          <input id="password" name="password" type="password" placeholder="••••••••" required autoComplete="current-password" />
        </div>

        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Входим…" : "Войти"}
        </button>

        {botUsername && <TelegramLoginButton botUsername={botUsername} />}
      </form>
    </div>
  );
}
