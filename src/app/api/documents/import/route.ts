import { NextResponse } from "next/server";
import { requireUser, str, jsonError } from "@/lib/api";
import { createDocument } from "@/lib/documents";
import { IMPORT_EXTENSIONS, convertImport, emptyDoc } from "@/lib/import";

export async function POST(request: Request): Promise<NextResponse> {
  const { user } = await requireUser();
  if (!user) return jsonError(401, "Authentication required");

  let body: { filename?: unknown; text?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const filename = str(body.filename, 260);
  const text = typeof body.text === "string" ? body.text.slice(0, 1_500_000) : undefined;
  if (!filename || text === undefined) {
    return jsonError(400, "filename and text are required");
  }

  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (!(IMPORT_EXTENSIONS as readonly string[]).includes(ext)) {
    return jsonError(
      415,
      `Unsupported file type ".${ext}". Only .txt and .md files can be imported.`,
    );
  }

  const converted = convertImport(filename, text);
  if (!converted) {
    return jsonError(415, `Unsupported file type ".${ext}". Only .txt and .md files can be imported.`);
  }

    const fallbackTitle = filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  const title = str(converted.title, 120) ?? str(fallbackTitle, 120) ?? "Imported document";

  const doc = await createDocument({
    ownerId: user.id,
    title,
    content: converted.doc ?? emptyDoc(),
  });

  return NextResponse.json(
    { id: doc.id, title: doc.title, updatedAt: doc.updated_at },
    { status: 201 },
  );
}
