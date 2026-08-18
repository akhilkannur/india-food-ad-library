import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { hasAdminCredentials, isDemoMode } from "@/lib/config";

const COOKIE_NAME = "food_ad_library_admin";
const SESSION_SECONDS = 60 * 60 * 24 * 14;

function digest(value: string) {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "dev-only-secret")
    .update(value)
    .digest("hex");
}

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(digest(left));
  const rightBuffer = Buffer.from(digest(right));
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function credentialsMatch(email: string, password: string) {
  if (!hasAdminCredentials) return false;
  return (
    secureEqual(email.trim().toLowerCase(), process.env.ADMIN_EMAIL!.trim().toLowerCase()) &&
    secureEqual(password, process.env.ADMIN_PASSWORD!)
  );
}

export async function createAdminSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const email = process.env.ADMIN_EMAIL!.trim().toLowerCase();
  const payload = `${email}.${expiresAt}`;
  const value = `${payload}.${digest(payload)}`;
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function destroyAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function isAdminAuthenticated() {
  if (isDemoMode && process.env.NODE_ENV !== "production") return true;
  if (!hasAdminCredentials) return false;

  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  if (!value) return false;

  const [email, expiresRaw, signature] = value.split(".");
  const expiresAt = Number(expiresRaw);
  if (!email || !expiresAt || !signature || expiresAt < Date.now() / 1000) return false;
  if (!secureEqual(signature, digest(`${email}.${expiresAt}`))) return false;
  return secureEqual(email, process.env.ADMIN_EMAIL!.trim().toLowerCase());
}
