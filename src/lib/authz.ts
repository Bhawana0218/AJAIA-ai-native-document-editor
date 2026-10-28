import type { DocumentRecord, ShareRecord } from "@/db";

export type Role = "owner" | "editor" | "viewer" | null;

export type PermissionContext = {
  document: Pick<DocumentRecord, "id" | "owner_id">;
  userId: string;
    share: ShareRecord | null;
};

export function effectiveRole(ctx: PermissionContext): Role {
  if (ctx.document.owner_id === ctx.userId) return "owner";
  if (ctx.share) return ctx.share.role;
  return null; 
}

export function canRead(ctx: PermissionContext): boolean {
  return effectiveRole(ctx) !== null;
}

export function canEditContent(ctx: PermissionContext): boolean {
  const role = effectiveRole(ctx);
  return role === "owner" || role === "editor";
}

export function canManageDocument(ctx: PermissionContext): boolean {
  return effectiveRole(ctx) === "owner";
}

export function canGrantRole(ctx: PermissionContext, role: "viewer" | "editor"): boolean {
  const actor = effectiveRole(ctx);
  if (actor === "owner") return true;
  if (actor === "editor") return role === "viewer";
  return false;
}
