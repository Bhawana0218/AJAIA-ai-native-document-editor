import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentUser } from "@/lib/session";

export async function POST(): Promise<NextResponse> {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}
