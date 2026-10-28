# Ajaia Docs

A professional collaborative document editor inspired by Google Docs, built as an
AI-native full-stack developer assignment for Ajaia LLC.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Tiptap 3 · PostgreSQL (postgres.js)

## Features

- Document CRUD: create, rename, edit, search, delete — with real Postgres persistence
- Rich text editor: bold, italic, underline, strikethrough, code, H1–H4, bullet lists,
  numbered lists, block quotes, code blocks, horizontal rules
- Autosave with visible **Saving / Saved / Error** states and unsaved-changes protection
- Dashboard with **My Documents** and **Shared with Me** tabs, live search, empty states
- Sharing with enforced roles: **Viewer** (read-only) and **Editor** (can edit), owner-only
  share administration, duplicate-share prevention (one row per recipient + document)
- Import `.txt` and `.md` files into editable documents (server-side conversion;
  other formats are rejected with a clear message)
- Server-side authorization on every document read/update/delete/share operation,
  with 404 responses (not 403) so document IDs cannot be probed by unauthorized users
- Seeded demo accounts with password-based sign-in (HMAC-signed HttpOnly session cookies)

## Prerequisites

- Node.js 18+ (tested on Node 22)
- Docker (for the local PostgreSQL instance), **or** a Postgres database
  (e.g. free-tier Supabase)

## Environment variables

Copy `.env.example` to `.env`:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Local default: `postgres://ajaia:ajaia@localhost:5433/ajaia_docs` |
| `SESSION_SECRET` | Secret used to sign session cookies. Generate one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DATABASE_SSL` | Set to `require` when connecting to hosted Postgres/Supabase that enforces SSL |

No service-role keys or database secrets are ever exposed to client code: only
Next.js server route handlers and server components read `DATABASE_URL` /
`SESSION_SECRET`, and the session cookie value alone is HMAC-signed server-side.

## Database setup (local)

```bash
npm run db:up        # starts Postgres 16 via docker compose (host port 5433)
npm run db:migrate   # applies SQL migrations from migrations/ (tracks in _migrations)
npm run db:seed      # (optional) seeds demo accounts + sample documents
```

`npm run db:seed` creates three accounts, all with password **`demo1234`**:

| Email | Role in demo data |
| --- | --- |
| `alice@demo.dev` | Owns 3 sample documents |
| `bob@demo.dev` | **Editor** on "Product Requirements — Docs MVP"; owns "Reading List" (shared with Alice as viewer) |
| `carol@demo.dev` | **Viewer** on "Meeting Notes — Kickoff" |

These pre-wired shares let you verify permission behavior immediately (sign in as
Bob → you can edit Alice's PRD but cannot rename/delete it; sign in as Carol →
read-only). Seeding is idempotent — rerun it anytime.

## Run the app

```bash
npm install
npm run dev          # http://localhost:3000
```

Production:

```bash
npm run build
npm start            # set PORT if 3000 is taken: PORT=3100 npm start
```

## Testing, lint, type check

```bash
npm test             # Vitest: authorization policy units + DB-backed integration + import tests
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint (flat config)
npm run build        # production build
```

Note: the DB integration suite skips itself automatically when `DATABASE_URL` is
not reachable (e.g. in CI without a database). Start the Docker DB first to run
everything.

## Deployment

The app is deployable to any Node host (verified locally with `next build` +
`next start`). **Deployment is performed by the repo owner via Vercel** —
one-time setup (from the Vercel dashboard or CLI):

1. **Project:** import the GitHub repo (`Bhawana0218/AJAIA-ai-native-document-editor`)
   into Vercel as project `ajaia-docs`. Framework preset: Next.js (auto-detected);
   build `next build`; no special Node version (18.18+; 20/22 recommended).
2. **Database — free-tier Neon or Supabase Postgres:**
   - Create the hosted database from the provider dashboard
     (or Vercel → Storage → Marketplace → Neon, which requires a one-time
     terms acceptance in the browser).
   - Copy the **session/direct connection string**.
   - Apply migrations from any machine that has repo access:
     `DATABASE_URL="<connection string>" DATABASE_SSL=require node scripts/migrate.mjs`
     (idempotent — tracks applied files in `_migrations`; also runs on Supabase).
   - Seed demo accounts the same way: `DATABASE_URL="..." DATABASE_SSL=require node scripts/seed.mjs`
3. **Environment variables (Vercel → Project → Settings → Env):**
   | Key | Value |
   | --- | --- |
   | `DATABASE_URL` | the hosted Postgres URL (add as **secret**, never in git) |
   | `SESSION_SECRET` | 64 hex chars: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `DATABASE_SSL` | `require` |
   | `DATABASE_POOL_MAX` | `3` (serverless-friendly) |
   | `DATABASE_PREPARE` | `false` — only if using a transaction-pooler URL (e.g. Supabase `:6543`) |
4. **Deploy** from the dashboard, then verify:
   - `GET /api/health` → `{"ok":true,"db":"up"}`
   - Sign in with a seeded account; create/edit a document; reload; share with
     another seeded account; confirm the recipient's Viewer/Editor behavior.
5. Secrecy: no client bundle ever receives `DATABASE_URL`/`SESSION_SECRET`;
   session cookies are HttpOnly and HMAC-signed server-side.

### Deployment status

Live URL: **(placeholder — see SUBMISSION.md)**. Deployment has not been verified
yet; per the honesty requirements of this assignment it is *not* claimed as done.

## Project scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:up` / `npm run db:down` | Start/stop dockerized Postgres |
| `npm run db:migrate` | Apply pending SQL migrations (idempotent) |
| `npm run db:seed` | Seed demo accounts + sample docs |
| `npm test` | Run Vitest suites |
| `npm run typecheck` / `npm run lint` | Type check / lint |

## Implemented vs. not

See `SUBMISSION.md` for the verified/incomplete feature matrix and `ARCHITECTURE.md`
for design and security details.

## Unsupported file formats (import)

Import accepts **`.txt`** and **`.md`/`.markdown`** only. Everything else
(`.pdf`, `.docx`, `.html`, images, …) is intentionally rejected with a 415 response
and a visible error message.
