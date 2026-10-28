import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getDocument, getPermissionContext, listShares } from "@/lib/documents";
import { canRead, effectiveRole } from "@/lib/authz";
import { DocumentEditor } from "@/components/DocumentEditor";

export const dynamic = "force-dynamic";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const ctx = await getPermissionContext(id, user.id);
  // Do not reveal whether a random document ID exists.
  if (!ctx || !canRead(ctx)) redirect("/dashboard?error=notfound");

  const doc = await getDocument(id);
  if (!doc) redirect("/dashboard?error=notfound");

  // Read-only pages don't need share lists fetched eagerly.
  let shares: Awaited<ReturnType<typeof listShares>> = [];
  let canManage = false;
  if (canRead(ctx)) {
    canManage = effectiveRole(ctx) === "owner";
    if (canManage || effectiveRole(ctx) === "editor") {
      shares = await listShares(id);
    }
  }

  return (
    <DocumentEditor
      doc={{
        id: doc.id,
        title: doc.title,
        content: doc.content as object,
        ownerName: doc.owner_name,
        updatedAt: doc.updated_at.toISOString(),
      }}
      role={effectiveRole(ctx) ?? "viewer"}
      user={{ id: user.id, name: user.name }}
      canManage={canManage}
      initialShares={shares.map((s) => ({
        id: s.id,
        recipientId: s.recipient_id,
        recipientName: s.recipient_name,
        recipientEmail: s.recipient_email,
        role: s.role,
      }))}
    />
  );
}
