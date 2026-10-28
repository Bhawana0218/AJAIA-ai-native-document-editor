import { NextResponse } from "next/server";
import { getCurrentUser, type SafeUser } from "@/lib/session";

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Resolves the caller or returns the appropriate unauthorized response. */
export async function requireUser(): Promise<
  { user: SafeUser; response: null } | { user: null; response: NextResponse }
> {
  try {
    const user = await getCurrentUser();
    if (user) return { user, response: null };
    return { user: null, response: jsonError(401, "Authentication required") };
  } catch (err) {
    console.error("requireUser failed:", err);
    return {
      user: null,
      response: jsonError(500, "Server configuration error"),
    };
  }
}

export function str(value: unknown, max = 4000): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  if (v.length === 0) return undefined;
  return v.slice(0, max);
}

export const NO_STORE = {
  "Cache-Control": "no-store",
} as const;
