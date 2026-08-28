"use client";

import { useActionState } from "react";
import { authenticate } from "@/app/actions/auth";
import { Icon } from "@/components/Icon";

export function LoginForm() {
  const [error, formAction, pending] = useActionState(authenticate, undefined);

  return (
    <div className="login-wrap">
      <form className="login-card" action={formAction}>
        <div className="logo">
          <Icon name="book" size={26} style={{ color: "#fff" }} />
        </div>
        <h1>Вход в CRM</h1>
        <p>МатАкадемия · система управления школой</p>

        {error && <div className="err">{error}</div>}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" placeholder="admin@matacademy.kz" defaultValue="admin@matacademy.kz" required autoComplete="username" />
        </div>
        <div className="field">
          <label htmlFor="password">Пароль</label>
          <input id="password" name="password" type="password" placeholder="••••••••" defaultValue="admin123" required autoComplete="current-password" />
        </div>

        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Входим…" : "Войти"}
        </button>

        <div className="demo-hint">
          <b>Демо-доступы:</b>
          <br />
          Администратор — admin@matacademy.kz / admin123
          <br />
          Менеджер — manager@matacademy.kz / manager123
          <br />
          Учитель — teacher@matacademy.kz / teacher123
        </div>
      </form>
    </div>
  );
}
