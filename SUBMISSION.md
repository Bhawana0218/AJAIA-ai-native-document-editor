# Submission — Ajaia Docs

Ajaia LLC · AI-Native Full Stack Developer Assignment
Repository contents: this project (Next.js 15 + TypeScript + Tailwind 4 + Tiptap 3 + PostgreSQL).

## Exact contents

```
README.md            setup, run, test, deploy instructions
ARCHITECTURE.md      structure, data model, authorization, decisions
AI_WORKFLOW.md       factual account of AI usage and verification
SUBMISSION.md        this file
WALKTHROUGH_URL.txt  placeholder for the recorded walkthrough video
docker-compose.yml   local Postgres 16 (host port 5433)
migrations/0001_init.sql   full schema (constraints, indexes, trigger)
scripts/             migrate.mjs, seed.mjs, env.mjs (no extra deps)
src/                 app/ (pages + API), db/, lib/, components/
tests/               vitest: authz.test.ts, db.authorization.test.ts, import.test.ts
package.json         scripts (dev/build/start/lint/typecheck/test/db:*)
eslint.config.mjs · tsconfig.json · vitest.config.ts · postcss.config.mjs
.env.example         documented env vars
```

## Implemented and verified features

- ✅ Create documents (own by default), edit in Tiptap, rename (owner), delete (owner, with confirmation)
- ✅ Rich text: bold, italic, underline, strikethrough, code, headings H1–H4, bullet lists, numbered lists, block quotes, code blocks, horizontal rules
- ✅ Autosave (1.2 s debounce) with visible Saving / Saved / Error states; unsaved-changes guard (beforeunload + flush on tab hide); bounded retry on failure
- ✅ Dashboard with My Documents / Shared with Me tabs, live search, counts, empty states
- ✅ Import `.txt` and `.md` (server-side conversion; unsupported formats rejected with a clear message)
- ✅ Sharing dialog: grant Viewer/Editor by email to registered users, revoke, duplicate-share prevention
- ✅ Server-side authorization on every read/update/delete/share; role matrix enforced (see ARCHITECTURE.md); unrelated users get 404
- ✅ Real Postgres persistence (no localStorage); SQL migrations with constraints + indexes + trigger
- ✅ Seeded-account authentication: scrypt password hashing, HMAC-signed HttpOnly cookies
- ✅ Responsive layout, accessible controls (labels, aria, focus states, keyboard shortcuts), restrained visual design

### Verification detail (HTTP permission matrix, production build)

| Check | Result |
| --- | --- |
| Unauthenticated `GET /api/documents` | 401 |
| Login with wrong password | 401 |
| Editor PATCH content | 200 |
| Editor PATCH title / DELETE | 403 / 403 |
| Editor grants editor role | 403 |
| Editor grants viewer role (new share) | 201 |
| Unrelated user GET/PATCH/DELETE/DELETE-share/grant-share | 404 × all (no existence leak) |
| Viewer PATCH content | 403 |
| Malformed / random document IDs | 404 |
| Import `.txt` / `.md` / `.pdf` | 201 / 201 / 415 |
| Share-with-owner (DB trigger) | rejected |
| Duplicate share | upsert (owner) / 403 for editor |

UI-level verification through a real browser session is described in AI_WORKFLOW.md.

## Tests, types, lint, build

- `npm test` — **28 tests / 3 files**, all passing (authorization units, DB integration suite, import converter suite)
- `npm run typecheck` — clean (strict TS)
- `npm run lint` — clean (0 errors, 0 warnings)
- `npm run build` — succeeds; routes listed in README

## Known limitations (honest status)

- **Live deployment not completed/verified.** WALKTHROUGH_URL and any live URL are placeholders. Deployment steps (Supabase free tier + Vercel/Railway) are documented in README; the production build was verified locally (`next build` + `next start`), and the DB was only exercised via local Docker Postgres. Remaining manual actions: create hosted Postgres, run migrations + seed against it, deploy, smoke test.
- **No true real-time co-editing** — saves are debounced last-write-wins; two simultaneous editors can overwrite each other's changes at save granularity.
- **Editing one document concurrently from two tabs is not conflict-safe** (documented in ARCHITECTURE).
- **Registration flow not implemented** — accounts come from seeding only (assignment-sanctioned mechanism). Unknown emails are rejected at share time.
- Mobile responsiveness is implemented via Tailwind responsive classes but was not pixel-verified on physical devices; screenshots were unavailable in this environment (headless/non-visible browser window).
- Imported Markdown covers a defined subset (see ARCHITECTURE). Tables/footnotes/images are not converted.

## Reviewer credentials

Seeded accounts (password for all: **`demo1234`**), created by `npm run db:seed`:

| Email | Role |
| --- | --- |
| `alice@demo.dev` | Document owner; owns 3 sample docs |
| `bob@demo.dev` | Editor on "Product Requirements — Docs MVP", owner of "Reading List" |
| `carol@demo.dev` | Viewer on "Meeting Notes — Kickoff" |

Quick-verify permission behavior: log in as Bob → open "Product Requirements — Docs MVP"
(you can edit; Share dialog lets you invite viewers only); try renaming as Bob → denied.

## Local run

```bash
npm install
npm run db:up        # docker Postgres on :5433
npm run db:migrate
npm run db:seed      # demo accounts above
npm run dev          # http://localhost:3000
```

See README.md for env vars (`DATABASE_URL`, `SESSION_SECRET`, `DATABASE_SSL`).
