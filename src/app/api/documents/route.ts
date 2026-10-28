import { NextResponse } from "next/server";
import { requireUser, str, jsonError } from "@/lib/api";
import { createDocument, listDocumentsForUser } from "@/lib/documents";
import { emptyDoc } from "@/lib/import";

export async function GET(): Promise<NextResponse> {
  const { user } = await requireUser();
  if (!user) return jsonError(401, "Authentication required");
  const documents = await listDocumentsForUser(user.id);
  return NextResponse.json(
    {
      documents: documents.map((d) => ({
        id: d.id,
        title: d.title,
        role: d.role,
        ownerName: d.owner_name,
        updatedAt: d.updated_at,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  const { user } = await requireUser();
  if (!user) return jsonError(401, "Authentication required");

  let body: { title?: unknown } = {};
  try {
    body = await request.json();
  } catch {
      }
  const title = str(body.title, 120) ?? "Untitled";

  const doc = await createDocument({ ownerId: user.id, title, content: emptyDoc() });
  return NextResponse.json(
    {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      ownerId: doc.owner_id,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
    },
    { status: 201 },
  );
}
