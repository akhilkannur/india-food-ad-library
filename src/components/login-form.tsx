"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/admin/login/actions";

const initialState: LoginState = {};

export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <form className="form-stack" action={action}>
      <div className="field">
        <label htmlFor="email">Admin email</label>
        <input id="email" name="email" type="email" autoComplete="email" required disabled={!configured} />
        <p className="field__hint">The address configured in ADMIN_EMAIL.</p>
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required disabled={!configured} />
        <p className="field__hint">Stored only as a deployment secret.</p>
      </div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {!configured && <p className="form-error">Admin sign-in is not configured. Add ADMIN_EMAIL, ADMIN_PASSWORD and AUTH_SECRET.</p>}
      <button className="button button--primary" type="submit" disabled={pending || !configured}>
        {pending ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
