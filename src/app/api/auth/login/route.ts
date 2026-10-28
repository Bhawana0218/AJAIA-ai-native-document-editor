import { NextResponse } from "next/server";
import { sql } from "@/db";
import { verifyPassword } from "@/lib/passwords";
import { setSessionCookie } from "@/lib/session";
import { jsonError, str } from "@/lib/api";

export async function POST(request: Request): Promise<NextResponse> {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }
  const email = str(body.email, 200)?.toLowerCase();
  // Passwords are compared exactly (no trimming).
  const password =
    typeof body.password === "string" && body.password.length > 0
      ? body.password.slice(0, 200)
      : undefined;
  if (!email || !password) {
    return jsonError(400, "Email and password are required");
  }

  const rows = await sql<{ id: string; email: string; name: string; password_hash: string }[]>`
    select id, email, name, password_hash from users where lower(email) = ${email} limit 1
  `;
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return jsonError(401, "Invalid email or password");
  }

  await setSessionCookie(user.id);
  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
  });
}
