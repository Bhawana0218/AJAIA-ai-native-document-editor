import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "@/db";
import type { User } from "@/db";

const COOKIE_NAME = "ajaia_session";
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; 

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "SESSION_SECRET is missing or too short. Generate one: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: string): string {
  const payload = `${userId}.${Date.now() + SESSION_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

function parseSessionToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiryMs, mac] = parts;
  const expected = sign(`${userId}.${expiryMs}`);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(expiryMs) < Date.now()) return null;
  return userId;
}

export async function setSessionCookie(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = parseSessionToken(token);
  if (!userId) return null;
  const rows = await sql<{ id: string; email: string; name: string }[]>`
    select id, email, name from users where id = ${userId} limit 1
  `;
  return rows[0] ?? null;
}

export type SafeUser = Pick<User, "id" | "email" | "name">;
