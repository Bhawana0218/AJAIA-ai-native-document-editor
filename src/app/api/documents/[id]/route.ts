import { NextResponse } from "next/server";
import { requireUser, str, jsonError } from "@/lib/api";
import {
  deleteDocument,
  getDocument,
  getPermissionContext,
  updateDocument,
} from "@/lib/documents";
import { canEditContent, canManageDocument, canRead } from "@/lib/authz";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params): Promise<NextResponse> {
  const { user } = await requireUser();
  if (!user) return jsonError(401, "Authentication required");
  const { id } = await params;

  const ctx = await getPermissionContext(id, user.id);
  if (!ctx) return jsonError(404, "Document not found");
  const doc = await getDocument(id);
  if (!doc || !canRead(ctx)) {
    // Do not leak existence to unrelated users.
    return jsonError(404, "Document not found");
  }

  return NextResponse.json(
    {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      ownerId: doc.owner_id,
      ownerName: doc.owner_name,
      ownerEmail: doc.owner_email,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
      role: ctx.share?.role ?? (ctx.document.owner_id === user.id ? "owner" : null),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  const { user } = await requireUser();
  if (!user) return jsonError(401, "Authentication required");
  const { id } = await params;

  const ctx = await getPermissionContext(id, user.id);
  // 404 (not 403) for unrelated users so document IDs cannot be enumerated.
  if (!ctx || !canRead(ctx)) return jsonError(404, "Document not found");

  if (!canEditContent(ctx)) {
    return jsonError(403, "You have read-only access to this document");
  }

  let body: { title?: unknown; content?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const patch: { title?: string; content?: unknown } = {};

  if (body.title !== undefined) {
    if (!canManageDocument(ctx)) {
      return jsonError(403, "Only the document owner can rename it");
    }
    const title = str(body.title, 120);
    if (!title) return jsonError(400, "Title cannot be empty");
    patch.title = title;
  }

  if (body.content !== undefined) {
    const node = body.content as { type?: unknown; content?: unknown } | null;
    if (
      typeof node !== "object" ||
      node === null ||
      node.type !== "doc" ||
      !Array.isArray(node.content)
    ) {
      return jsonError(400, "content must be a ProseMirror doc node");
    }
    patch.content = body.content;
  }

  if (Object.keys(patch).length === 0) {
    return jsonError(400, "Nothing to update");
  }

  try {
    const updated = await updateDocument(id, patch);
    if (!updated) return jsonError(404, "Document not found");
    return NextResponse.json({
      id: updated.id,
      title: updated.title,
      updatedAt: updated.updated_at,
    });
  } catch (err) {
    console.error("PATCH /api/documents/[id] failed:", err);
    return jsonError(500, "Failed to save document");
  }
}

export async function DELETE(_request: Request, { params }: Params): Promise<NextResponse> {
  const { user } = await requireUser();
  if (!user) return jsonError(401, "Authentication required");
  const { id } = await params;

  const ctx = await getPermissionContext(id, user.id);
  if (!ctx || !canRead(ctx)) return jsonError(404, "Document not found");

  if (!canManageDocument(ctx)) {
    return jsonError(403, "Only the document owner can delete it");
  }

  const deleted = await deleteDocument(id);
  if (!deleted) return jsonError(404, "Document not found");
  return NextResponse.json({ ok: true });
}
