import { describe, expect, it } from "vitest";
import {
  canEditContent,
  canGrantRole,
  canManageDocument,
  canRead,
  effectiveRole,
} from "@/lib/authz";
import type { DocumentRecord, ShareRecord } from "@/db";

const doc = { id: "d1", owner_id: "alice" } as Pick<DocumentRecord, "id" | "owner_id">;

function ctx(opts: { userId: string; share?: Partial<ShareRecord> }) {
  return {
    document: doc,
    userId: opts.userId,
    share: opts.share ? ({ id: "s1", role: "viewer", ...opts.share } as ShareRecord) : null,
  };
}

describe("effectiveRole", () => {
  it("owner wins even if a stale share record exists", () => {
    expect(
      effectiveRole(ctx({ userId: "alice", share: { recipient_id: "alice", role: "viewer" } })),
    ).toBe("owner");
  });

  it("share role is effective for non-owners", () => {
    expect(
      effectiveRole(ctx({ userId: "bob", share: { recipient_id: "bob", role: "editor" } })),
    ).toBe("editor");
    expect(
      effectiveRole(ctx({ userId: "bob", share: { recipient_id: "bob", role: "viewer" } })),
    ).toBe("viewer");
  });

  it("unrelated users have no role", () => {
    expect(effectiveRole(ctx({ userId: "mallory" }))).toBeNull();
  });
});

describe("canRead", () => {
  it("owner can read their document", () => {
    expect(canRead(ctx({ userId: "alice" }))).toBe(true);
  });
  it("editor and viewer can read", () => {
    expect(canRead(ctx({ userId: "u", share: { recipient_id: "u", role: "editor" } }))).toBe(true);
    expect(canRead(ctx({ userId: "u", share: { recipient_id: "u", role: "viewer" } }))).toBe(true);
  });
  it("unrelated user cannot read", () => {
    expect(canRead(ctx({ userId: "mallory" }))).toBe(false);
  });
});

describe("canEditContent", () => {
  it("owner can edit", () => {
    expect(canEditContent(ctx({ userId: "alice" }))).toBe(true);
  });
  it("editor can edit", () => {
    expect(canEditContent(ctx({ userId: "u", share: { recipient_id: "u", role: "editor" } }))).toBe(
      true,
    );
  });
  it("viewer cannot edit", () => {
    expect(canEditContent(ctx({ userId: "u", share: { recipient_id: "u", role: "viewer" } }))).toBe(
      false,
    );
  });
  it("unrelated user cannot edit", () => {
    expect(canEditContent(ctx({ userId: "mallory" }))).toBe(false);
  });
});

describe("canManageDocument", () => {
  it("only the owner manages rename/delete/sharing", () => {
    expect(canManageDocument(ctx({ userId: "alice" }))).toBe(true);
    expect(canManageDocument(ctx({ userId: "u", share: { recipient_id: "u", role: "editor" } }))).toBe(
      false,
    );
    expect(canManageDocument(ctx({ userId: "u", share: { recipient_id: "u", role: "viewer" } }))).toBe(
      false,
    );
  });
});

describe("canGrantRole", () => {
  const editorCtx = ctx({ userId: "u", share: { recipient_id: "u", role: "editor" } });
  const viewerCtx = ctx({ userId: "u", share: { recipient_id: "u", role: "viewer" } });
  const ownerCtx = ctx({ userId: "alice" });

  it("owner can grant viewer and editor", () => {
    expect(canGrantRole(ownerCtx, "viewer")).toBe(true);
    expect(canGrantRole(ownerCtx, "editor")).toBe(true);
  });
  it("editor can only grant viewer", () => {
    expect(canGrantRole(editorCtx, "viewer")).toBe(true);
    expect(canGrantRole(editorCtx, "editor")).toBe(false);
  });
  it("viewer cannot grant anything", () => {
    expect(canGrantRole(viewerCtx, "viewer")).toBe(false);
    expect(canGrantRole(viewerCtx, "editor")).toBe(false);
  });
  it("unrelated user cannot grant anything", () => {
    const mallory = ctx({ userId: "mallory" });
    expect(canGrantRole(mallory, "viewer")).toBe(false);
    expect(canGrantRole(mallory, "editor")).toBe(false);
  });
});
