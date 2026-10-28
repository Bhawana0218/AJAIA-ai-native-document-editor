import { NextResponse } from "next/server";
import { sql } from "@/db";

/**
 * Liveness + DB connectivity probe for deployment verification.
 * Returns no application data and no configuration details.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await sql`select 1`;
    return NextResponse.json({ ok: true, db: "up" });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
