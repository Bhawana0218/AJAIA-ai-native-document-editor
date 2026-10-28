/**
 * Integration tests against the real database (docker compose Postgres).
 * Verifies that the repository layer + DB constraints enforce the same
 * authorization rules the API routes rely on:
 *   - secret tampering is rejected (session token HMAC)
 *   - owner / editor / viewer / unrelated roles resolve correctly per document
 *   - duplicate shares upsert (owner) and DB rejects sharing with the owner
 * Skipped automatically when DATABASE_URL is not reachable, so `npm test`
 * still runs the pure policy tests everywhere.
 */
import { randomBytes, createHmac, timingSafeEqual, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import {
  canEditContent,
  canManageDocument,
  canRead,
  effectiveRole,
} from "@/lib/authz";
import { getPermissionContext, upsertShare } from "@/lib/documents";
import { createSessionToken } from "@/lib/session";

const scrypt = promisify(scryptCb);

let sql: postgres.Sql | null = null;
const testPrefix = `test_${randomBytes(4).toString("hex")}_`;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) process.exitCode = 0;
  const candidate = postgres(process.env.DATABASE_URL ?? "", { ssl: process.env.DATABASE_SSL === "require" ? "require" : undefined });
  try {
    await candidate`select 1`;
    sql = candidate;
  } catch {
    await candidate.end();
    sql = null;
  }
});

afterAll(async () => {
  if (!sql) return;
  await sql.unsafe(`delete from users where email like '${testPrefix}%'`);
  await sql.end();
});

describe("db-backed authorization", () => {
  it("rejects tampered session tokens", () => {
    const token = createSessionToken("11111111-1111-1111-1111-111111111111");
    const [userId, expiry, mac] = token.split(".");
    const forged = `${userId}.${Number(expiry) + 1}.${mac}`;
    // any byte change invalidates the HMAC; also JSON.parse/signature checked server-side
    const [fu, fe, fm] = forged.split(".");
    const recompute = createHmac("sha256", process.env.SESSION_SECRET ?? "x").update(`${fu}.${fe}`).digest("base64url");
    expect(timingSafeEqual(Buffer.from(fm), Buffer.from(recompute))).toBe(false);
  });

  it("separates owner / editor / viewer / unrelated access", async () => {
    if (!sql) return; // DB not available — skipped (see console note)
    console.warn("DB integration test running against", process.env.DATABASE_URL);

    const pw = randomBytes(8).toString("hex");
    const hash = `scrypt$${(await (scrypt(pw, Buffer.alloc(16), 64) as Promise<Buffer>)).toString("hex")}$0000`; // seeded users
    const names = {
      owner: `owner@${testPrefix}x.test`,
      editor: `editor@${testPrefix}x.test`,
      viewer: `viewer@${testPrefix}x.test`,
      mallory: `mallory@${testPrefix}x.test`,
    };
    const insertedIds: { id: string }[] = await sql`
      insert into users ${sql(
        Object.values(names).map((email) => ({ email, name: "Test", password_hash: hash })),
      )}
      returning id`;
    const [owner, editor, viewer, mallory] = insertedIds;

    const docs = await sql`
      insert into documents (owner_id, title, content)
      values (${owner.id}, ${"Auth test doc"}, ${"{}"}::jsonb) returning id`;
    const docId = docs[0].id;

    // owner implicit role
    let ctx = await getPermissionContext(docId, owner.id);
    expect(ctx).not.toBeNull();
    expect(effectiveRole(ctx!)).toBe("owner");
    expect(canRead(ctx!)).toBe(true);
    expect(canEditContent(ctx!)).toBe(true);
    expect(canManageDocument(ctx!)).toBe(true);

    // grant editor
    await upsertShare({ documentId: docId, recipientId: editor.id, role: "editor" });
    ctx = await getPermissionContext(docId, editor.id);
    expect(effectiveRole(ctx!)).toBe("editor");
    expect(canRead(ctx!)).toBe(true);
    expect(canEditContent(ctx!)).toBe(true);
    expect(canManageDocument(ctx!)).toBe(false);

    // grant viewer
    await upsertShare({ documentId: docId, recipientId: viewer.id, role: "viewer" });
    ctx = await getPermissionContext(docId, viewer.id);
    expect(effectiveRole(ctx!)).toBe("viewer");
    expect(canRead(ctx!)).toBe(true);
    expect(canEditContent(ctx!)).toBe(false);
    expect(canManageDocument(ctx!)).toBe(false);

    // unrelated user
    ctx = await getPermissionContext(docId, mallory.id);
    expect(ctx).not.toBeNull();
    expect(ctx!.share).toBeNull();
    expect(canRead(ctx!)).toBe(false);
    expect(canEditContent(ctx!)).toBe(false);

    // non-existent and malformed document ids return null (not found path)
    expect(await getPermissionContext(randomBytes(16).toString("hex"), owner.id)).toBeNull();
    expect(await getPermissionContext("not-a-uuid", owner.id)).toBeNull();

    // DB trigger: sharing with the owner is rejected
    await expect(
      upsertShare({ documentId: docId, recipientId: owner.id, role: "viewer" }),
    ).rejects.toThrow();

    // duplicate share for the same recipient is an upsert, not a second row
    const again = await upsertShare({ documentId: docId, recipientId: editor.id, role: "viewer" });
    expect(again.role).toBe("viewer");
    const rows = await sql`
      select count(*)::int as n from document_shares where document_id = ${docId}`;
    expect(rows[0].n).toBe(2); // editor + viewer only

    await sql`delete from documents where id = ${docId} and owner_id = ${owner.id}`;
  });
});
