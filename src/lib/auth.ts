import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "satoshi_admin";

function adminPassword(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) throw new Error("ADMIN_PASSWORD is not set (see .env.example)");
  return pw;
}

/** Deterministic session token derived from the admin password. */
export function sessionToken(): string {
  return createHmac("sha256", adminPassword()).update("satoshi-admin-session-v1").digest("hex");
}

export function verifyPassword(candidate: string): boolean {
  const a = Buffer.from(candidate);
  const b = Buffer.from(adminPassword());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isAuthed(): boolean {
  try {
    const cookie = cookies().get(ADMIN_COOKIE)?.value;
    if (!cookie) return false;
    const expected = sessionToken();
    const a = Buffer.from(cookie);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
