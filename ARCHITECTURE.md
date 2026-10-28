# Ajaia Docs — Architecture

## Overview

Next.js 15 (App Router) is used full-stack: React server components render the
dashboard and document pages, and route handlers under `/api` implement the
document-sharing backend. Persistence is PostgreSQL via `postgres.js` (thin,
dependency-light driver). Tiptap/ProseMirror provides the editor; documents are
stored as **ProseMirror JSON nodes in a `jsonb` column**.

```
src/
  app/
    page.tsx                      # redirect by session
    login/page.tsx                # seeded-account sign-in (+ client form)
    dashboard/page.tsx            # server: auth + list; renders DashboardClient
    docs/[id]/page.tsx            # server: auth + role resolution; renders DocumentEditor
    api/
      auth/login|logout           # POST only; scrypt verify; HMAC session cookie
      documents/route.ts          # GET list (owned+shared), POST create
      documents/[id]/route.ts     # GET / PATCH / DELETE with role checks
      documents/[id]/shares/      # GET list, POST grant, DELETE revoke (?shareId=)
      documents/import/route.ts   # POST .txt/.md -> new document
  db/index.ts                     # postgres.js singleton + row types
  lib/
    authz.ts                      # PURE permission policy (unit-tested)
    documents.ts                  # data access + SQL (repository layer)
    session.ts                    # HMAC-signed cookie sessions (node:crypto)
    passwords.ts                  # scrypt hashing + timing-safe verification
    import.ts                     # .txt/.md -> ProseMirror JSON parser
    api.ts                        # requireUser/jsonError helpers
  components/                     # client UI (editor, toolbar, dialogs, dashboard)
migrations/0001_init.sql          # schema + constraints + indexes + trigger
scripts/{migrate,seed,env}.mjs    # reproducible setup, no extra deps
tests/                            # vitest: authz policy, DB integration, import
```

## Data model

```
users(id uuid pk, email unique not null, name, password_hash (scrypt), created_at)

documents(id uuid pk, owner_id -> users, title, content jsonb (ProseMirror doc),
          created_at, updated_at)
  index: documents(owner_id, updated_at desc)   -- "My Documents"

document_shares(id uuid pk, document_id -> documents on delete cascade,
                recipient_id -> users on delete cascade,
                role text check in ('viewer','editor'), created_at,
                unique (document_id, recipient_id))               -- duplicate-share guard
  index: document_shares(recipient_id, document_id)               -- "Shared with Me"
  trigger: rejects a share whose recipient is the document owner
```

Notes:

- Ownership is stored only on `documents.owner_id`; a share row for the owner is
  impossible (trigger) and the role resolver treats owners as a distinct role
  regardless of any hypothetical share row.
- `document_shares` unique constraint means each user has exactly one share per
  document: "duplicate sharing" is an upsert (owner) or a rejection (editor),
  enforced in the API layer.

## Authorization

`src/lib/authz.ts` is a pure function layer; every mutating API route resolves a
`PermissionContext` (`{ document, userId, share }`) via the repository, then asks
the policy:

| Operation | owner | editor | viewer | unrelated |
| --- | --- | --- | --- | --- |
| Read (GET) | ✅ | ✅ | ✅ | ❌ 404 |
| Edit content (PATCH content) | ✅ | ✅ | ❌ 403 | ❌ 404 |
| Rename (PATCH title) / delete | ✅ | ❌ 403 | ❌ 403 | ❌ 404 |
| Grant viewer | ✅ | ✅ (new shares only) | ❌ | ❌ |
| Grant editor / change a role | ✅ | ❌ 403 | ❌ | ❌ |
| Revoke / share admin (GET canManage) | ✅ | ❌ | ❌ | ❌ |

Security-relevant decisions:

- **Unrelated users receive 404, not 403** for GET/PATCH/DELETE/share-listing, so
  intercepting a document ID in the URL yields no existence signal.
- **Session mechanism**: `cookie(ajaia_session) = userId.expiry.HMAC-SHA256(userId.expiry, SECRET)`.
  HttpOnly, SameSite=Lax, Secure in production; `timingSafeEqual` on decode. The
  secret lives only in the server env (`SESSION_SECRET`). Passwords use scrypt
  with per-user salt and timing-safe comparison.
- **Client code never sees DB credentials** — `DATABASE_URL`/`SESSION_SECRET` are
  read only inside server modules, and Next's server/client boundary enforces this
  structurally (server-only imports are not shipped to the browser bundle; all
  data flows through `/api` endpoints or server props).
- This deployment targets Supabase **database access via the app server**, not
  the client API, so Row Level Security is not load-bearing for authorization —
  the app's own route-level checks are the policy (documented tradeoff below).
  The seeded SQL still cleans up structure with constraints/checks at the schema
  level (role CHECK, unique share, owner-share trigger).

## Persistence & saving

- Autosave: editor `onUpdate` marks dirty and schedules `PATCH` after a 1.2 s
  debounce. Status machine: `idle → saving → saved | error`, surfaced in the toolbar.
- Failure handling: on failure the UI shows an explicit error with a manual
  reload affordance; saves retry with bounded backoff (max 3 attempts, 3 s), and
  any further edit reschedules immediately.
- Unsaved-changes protection: `beforeunload` blocks navigation while dirty, and
  `visibilitychange: hidden` flushes a save (e.g. when switching browser tabs).

## Sharing dialog

- Owner: grant by registered email with Viewer/Editor role select, update roles
  (upsert) or revoke. Errors are shown inline (404 unknown user, 400 self/owner).
- Editor: can invite **viewers only**, and cannot modify an existing share.
- Viewer: sees the collaborator list, cannot grant (403 from API; UI hides controls).

## Import pipeline

`src/lib/import.ts` converts uploaded text server-side:

- `.md`: ATX headings (H1–H4), bullet/ordered lists (with explicit start numbers),
  fenced code blocks, blockquotes, horizontal rules, paragraphs; inline bold /
  italic / strike / code / links. Title comes from the first heading, else the
  filename.
- `.txt`: paragraphs split on blank lines; in-paragraph line breaks preserved as
  hard breaks.
- Everything else → `415` with a clear message. Import endpoints are
  authenticated and create documents **owned by the importing user**.

## Key decisions & tradeoffs

1. **Seeded accounts instead of full auth registration** — the assignment allows
   it; it keeps scope within the timebox while still exercising real
   authentication (hashed passwords, signed cookies). registering self-serve
   users would be the next step; emails exist only as seeded identities.
2. **ProseMirror JSON in `jsonb`** (not HTML strings): lossless round-trip with
   the editor, cheap validation (`doc` shape check), and no XSS surface from
   stored markup — content is only rendered through Tiptap.
3. **App-level authorization without RLS in the request path**: the DB client is
   `postgres.js` over a server-side pooled connection, so per-user RLS policies
   would need each query to carry the caller identity (e.g. `set local
   request.jwt.claims`). Given one server-side connection pool and
   server-enforced route checks, RLS was traded for clarity; the policy table
   above is what the tests enforce.
4. **No real-time co-editing**: updates are last-write-wins per document (title
   + content saved atomically in one PATCH). Two editors can overwrite each
   other's keystrokes at paragraph granularity. Documented in SUBMISSION as a
   known limitation.
5. **Minimal dependencies**: no ORM, no auth library, no markdown package —
   smaller attack surface, easier to audit, but migrations are hand-written SQL.
