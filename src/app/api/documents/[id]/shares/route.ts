import { NextResponse } from "next/server";
import { requireUser, str, jsonError } from "@/lib/api";
import { deleteShare, findUserByEmail, getPermissionContext, listShares, upsertShare } from "@/lib/documents";
import { canGrantRole, canManageDocument, canRead, effectiveRole } from "@/lib/authz";

type Params = { params: Promise<{ id: string }> };

function serializeShare(s: {
  id: string;
  document_id: string;
  recipient_id: string;
  role: string;
  created_at: Date;
  recipient_email: string;
  recipient_name: string;
}) {
  return {
    id: s.id,
    documentId: s.document_id,
    recipientId: s.recipient_id,
    role: s.role,
    createdAt: s.created_at,
    recipientEmail: s.recipient_email,
    recipientName: s.recipient_name,
  };
}

/** Lists current collaborators. Readable by anyone who can read the doc. */
export async function GET(_request: Request, { params }: Params): Promise<NextResponse> {
  const { user } = await requireUser();
  if (!user) return jsonError(401, "Authentication required");
  const { id } = await params;
  const ctx = await getPermissionContext(id, user.id);
  if (!ctx || !canRead(ctx)) return jsonError(404, "Document not found");

  const shares = await listShares(id);
  return NextResponse.json(
    {
      shares: shares.map(serializeShare),
      canManage: canManageDocument(ctx),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Grants or updates a share. Rules:
 *  - Owners grant viewer or editor to anyone except themselves.
 *  - Editors may only grant the "viewer" role, and only as a NEW share
 *    (they can never modify an existing share, including their own).
 *  - Duplicate sharing with the same recipient updates the role (owner only)
 *    or is rejected (editor).
 */
export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  const { user } = await requireUser();
  if (!user) return jsonError(401, "Authentication required");
  const { id } = await params;
  const ctx = await getPermissionContext(id, user.id);
  if (!ctx || !canRead(ctx)) return jsonError(404, "Document not found");
  const actorRole = effectiveRole(ctx);

  if (actorRole === "viewer") {
    return jsonError(403, "Viewers cannot share documents");
  }

  let body: { email?: unknown; role?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const email = str(body.email, 200)?.toLowerCase();
  const role = body.role === "editor" || body.role === "viewer" ? body.role : undefined;
  if (!email || !role) {
    return jsonError(400, "email and role ('viewer' or 'editor') are required");
  }

  if (!canGrantRole(ctx, role)) {
    return jsonError(403, "Editors can only grant Viewer access");
  }

  const recipient = await findUserByEmail(email);
  if (!recipient) {
    return jsonError(404, `No registered user with email ${email}`);
  }
  if (recipient.id === ctx.document.owner_id) {
    return jsonError(400, "This user is the document owner");
  }

  // Editors cannot modify an existing share (incl. their own); owners can
  // update the role. Detect existing shares before the upsert.
  const existing = (await listShares(id)).find((s) => s.recipient_id === recipient.id);
  if (existing && actorRole !== "owner") {
    return jsonError(403, "This user already has access; only the owner can change it");
  }

  try {
    const share = await upsertShare({
      documentId: id,
      recipientId: recipient.id,
      role,
    });
    const shares = await listShares(id);
    const current = shares.find((s) => s.recipient_id === recipient.id);
    return NextResponse.json(
      {
        share: current
          ? serializeShare({ ...current, recipient_email: recipient.email, recipient_name: recipient.name })
          : serializeShare({ ...share, recipient_email: recipient.email, recipient_name: recipient.name }),
      },
      { status: existing ? 200 : 201 },
    );
  } catch (err) {
    console.error("POST /api/documents/[id]/shares failed:", err);
    return jsonError(500, "Failed to grant access");
  }
}

/** Revokes a share. Owner-only. */
export async function DELETE(request: Request, { params }: Params): Promise<NextResponse> {
  const { user } = await requireUser();
  if (!user) return jsonError(401, "Authentication required");
  const { id } = await params;
  const ctx = await getPermissionContext(id, user.id);
  if (!ctx || !canManageDocument(ctx)) {
    return jsonError(404, "Document not found");
  }

  const url = new URL(request.url);
  const shareId = url.searchParams.get("shareId");
  if (!shareId) return jsonError(400, "shareId query parameter is required");

  const deleted = await deleteShare(shareId, id);
  if (!deleted) return jsonError(404, "Share not found");
  return NextResponse.json({ ok: true });
}
