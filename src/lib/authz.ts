import type { DocumentRecord, ShareRecord } from "@/db";

export type Role = "owner" | "editor" | "viewer" | null;

export type PermissionContext = {
  document: Pick<DocumentRecord, "id" | "owner_id">;
  userId: string;
  /** Share record for this user on this document, if any (null when none/owner). */
  share: ShareRecord | null;
};

/**
 * Effective role of a user on a document.
 * Owners always take precedence — a user cannot be demoted by a share record.
 */
export function effectiveRole(ctx: PermissionContext): Role {
  if (ctx.document.owner_id === ctx.userId) return "owner";
  if (ctx.share) return ctx.share.role;
  return null; // unrelated user — no access at all
}

/** Read access (dashboard, editor page, document listing). */
export function canRead(ctx: PermissionContext): boolean {
  return effectiveRole(ctx) !== null;
}

/** Content edits. Owners and editors only — viewers are strictly read-only. */
export function canEditContent(ctx: PermissionContext): boolean {
  const role = effectiveRole(ctx);
  return role === "owner" || role === "editor";
}

/** Owner-only mutations: rename, delete, and all sharing administration. */
export function canManageDocument(ctx: PermissionContext): boolean {
  return effectiveRole(ctx) === "owner";
}

/**
 * Granting access. Owners grant any role. Editors can only grant the
 * "viewer" role — they may invite read-only users but can never grant
 * editor access or promote anyone (and never themselves).
 */
export function canGrantRole(ctx: PermissionContext, role: "viewer" | "editor"): boolean {
  const actor = effectiveRole(ctx);
  if (actor === "owner") return true;
  if (actor === "editor") return role === "viewer";
  return false;
}
