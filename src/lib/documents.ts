import { sql, type DocumentRecord, type ShareRecord, type ShareWithUser } from "@/db";
import type { PermissionContext } from "@/lib/authz";

export type DocumentListItem = {
  id: string;
  title: string;
  role: "owner" | "editor" | "viewer";
  owner_name: string;
  updated_at: Date;
};

export async function listDocumentsForUser(userId: string): Promise<DocumentListItem[]> {
  return sql<DocumentListItem[]>`
    with mine as (
      select d.id, d.title, d.updated_at, 'owner' as role, u.name as owner_name,
             d.updated_at as activity_at
      from documents d
      join users u on u.id = d.owner_id
      where d.owner_id = ${userId}
      union all
      select d.id, d.title, d.updated_at, s.role, u.name as owner_name,
             greatest(d.updated_at, s.created_at) as activity_at
      from document_shares s
      join documents d on d.id = s.document_id
      join users u on u.id = d.owner_id
      where s.recipient_id = ${userId}
    )
    select id, title, role, owner_name, updated_at
    from mine
    order by activity_at desc
  `;
}

export async function getPermissionContext(
  documentId: string,
  userId: string,
): Promise<PermissionContext | null> {
  if (!isUuid(documentId)) return null;
  const docs = await sql<Pick<DocumentRecord, "id" | "owner_id">[]>`
    select id, owner_id from documents where id = ${documentId} limit 1
  `;
  if (docs.length === 0) return null;
  const shares = await sql<ShareRecord[]>`
    select id, document_id, recipient_id, role, created_at
    from document_shares
    where document_id = ${documentId} and recipient_id = ${userId}
    limit 1
  `;
  return { document: docs[0], userId, share: shares[0] ?? null };
}

export async function getDocument(documentId: string): Promise<
  | (Pick<DocumentRecord, "id" | "owner_id" | "title" | "content" | "created_at" | "updated_at"> & {
      owner_name: string;
      owner_email: string;
    })
  | null
> {
  if (!isUuid(documentId)) return null;
  const rows = await sql<
    (Pick<
      DocumentRecord,
      "id" | "owner_id" | "title" | "content" | "created_at" | "updated_at"
    > & { owner_name: string; owner_email: string })[]
  >`
    select d.id, d.owner_id, d.title, d.content, d.created_at, d.updated_at,
           u.name as owner_name, u.email as owner_email
    from documents d join users u on u.id = d.owner_id
    where d.id = ${documentId} limit 1
  `;
  if (rows.length === 0) return null;
  return rows[0];
}

export async function createDocument(input: {
  ownerId: string;
  title: string;
  content: unknown;
}): Promise<DocumentRecord> {
  const rows = await sql<DocumentRecord[]>`
    insert into documents (owner_id, title, content)
    values (${input.ownerId}, ${input.title}, ${JSON.stringify(input.content ?? null)}::jsonb)
    returning id, owner_id, title, content, created_at, updated_at
  `;
  return rows[0];
}

export async function updateDocument(
  documentId: string,
  patch: { title?: string; content?: unknown },
): Promise<DocumentRecord | null> {
  if (!isUuid(documentId)) return null;
  const setTitle = patch.title !== undefined ? patch.title : sql`title`;
  const setContent =
    patch.content !== undefined
      ? sql`${JSON.stringify(patch.content)}::jsonb`
      : sql`content`;
  const rows = await sql<DocumentRecord[]>`
    update documents set
      title = ${setTitle},
      content = ${setContent},
      updated_at = now()
    where id = ${documentId}
    returning id, owner_id, title, content, created_at, updated_at
  `;
  return rows[0] ?? null;
}

export async function deleteDocument(documentId: string): Promise<boolean> {
  if (!isUuid(documentId)) return false;
  const rows = await sql<{ id: string }[]>`
    delete from documents where id = ${documentId} returning id
  `;
  return rows.length > 0;
}


export async function listShares(documentId: string): Promise<ShareWithUser[]> {
  if (!isUuid(documentId)) return [];
  return sql<ShareWithUser[]>`
    select s.id, s.document_id, s.recipient_id, s.role, s.created_at,
           u.email as recipient_email, u.name as recipient_name
    from document_shares s join users u on u.id = s.recipient_id
    where s.document_id = ${documentId}
    order by s.created_at desc
  `;
}

export async function findUserByEmail(
  email: string,
): Promise<{ id: string; email: string; name: string } | null> {
  const rows = await sql<{ id: string; email: string; name: string }[]>`
    select id, email, name from users where lower(email) = ${email.trim().toLowerCase()} limit 1
  `;
  return rows[0] ?? null;
}

export async function upsertShare(input: {
  documentId: string;
  recipientId: string;
  role: "viewer" | "editor";
}): Promise<ShareRecord> {
  const rows = await sql<ShareRecord[]>`
    insert into document_shares (document_id, recipient_id, role)
    values (${input.documentId}, ${input.recipientId}, ${input.role})
    on conflict (document_id, recipient_id)
    do update set role = excluded.role
    returning id, document_id, recipient_id, role, created_at
  `;
  return rows[0];
}

export async function deleteShare(shareId: string, documentId: string): Promise<boolean> {
  if (!isUuid(shareId) || !isUuid(documentId)) return false;
  const rows = await sql<{ id: string }[]>`
    delete from document_shares where id = ${shareId} and document_id = ${documentId} returning id
  `;
  return rows.length > 0;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function serializeDocument(doc: DocumentRecord) {
  return {
    id: doc.id,
    title: doc.title,
    content: doc.content,
    ownerId: doc.owner_id,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}
