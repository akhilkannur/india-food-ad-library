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
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required disabled={!configured} />
      </div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {!configured && <p className="form-error">Admin sign-in is not available yet. Contact the site administrator to enable access.</p>}
      <button className="button button--primary" type="submit" disabled={pending || !configured}>
        {pending ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
