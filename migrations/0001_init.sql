-- 0001_init.sql — Ajaia Docs schema
-- Works identically on local Postgres (docker compose) and Supabase Postgres.

-- =========================================================
-- Users (seeded demo accounts; password hashes are scrypt)
-- =========================================================
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  name          text not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- =========================================================
-- Documents: ownership + structured ProseMirror/Tiptap content
-- =========================================================
create table if not exists documents (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references users(id) on delete cascade,
  title       text not null default 'Untitled',
  -- ProseMirror JSON produced by Tiptap (headings, lists, marks, ...):
  content     jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Dashboard "My Documents" lists documents by owner, newest activity first
create index if not exists documents_owner_id_updated_at_idx
  on documents (owner_id, updated_at desc);

-- =========================================================
-- Sharing: one share per (document, recipient); role is enforced app-side
-- =========================================================
create table if not exists document_shares (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  recipient_id uuid not null references users(id) on delete cascade,
  role        text not null check (role in ('viewer', 'editor')),
  created_at  timestamptz not null default now(),
  -- Duplicate-sharing prevention: a user has at most one share per document
  constraint document_shares_document_recipient_unique unique (document_id, recipient_id)
);

-- Dashboard "Shared with Me" and per-document role lookups
create index if not exists document_shares_recipient_id_idx
  on document_shares (recipient_id, document_id);

-- A recipient can never be the owner (owner access is implicit, not shared)
create or replace function validate_share_recipient() returns trigger as $$
begin
  if exists (
    select 1 from documents d
    where d.id = new.document_id and d.owner_id = new.recipient_id
  ) then
    raise exception 'Cannot share a document with its owner';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists validate_share_recipient_trigger on document_shares;
create trigger validate_share_recipient_trigger
  before insert or update on document_shares
  for each row execute function validate_share_recipient();
