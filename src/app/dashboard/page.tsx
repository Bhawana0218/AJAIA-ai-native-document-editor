import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listDocumentsForUser } from "@/lib/documents";
import { DashboardClient } from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const documents = await listDocumentsForUser(user.id);
  const initial = documents.map((d) => ({
    id: d.id,
    title: d.title,
    role: d.role,
    ownerName: d.owner_name,
    updatedAt: d.updated_at.toISOString(),
  }));

  return (
    <DashboardClient
      user={{ id: user.id, name: user.name, email: user.email }}
      initialDocuments={initial}
    />
  );
}
