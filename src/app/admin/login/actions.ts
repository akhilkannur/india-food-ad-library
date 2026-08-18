"use server";

import { redirect } from "next/navigation";
import { createAdminSession, credentialsMatch } from "@/lib/auth";

export type LoginState = { error?: string };

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!credentialsMatch(email, password)) {
    return { error: "Those credentials were not recognised. Check the email and password, then try again." };
  }

  await createAdminSession();
  redirect("/admin");
}
