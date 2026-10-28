# AI Workflow — Ajaia Docs

This describes how AI tools were used to build this repository, per the
assignment's honesty requirements. What follows is a factual account of the
session, not a narrative of imagined experiences.

## Tools used

- **GLM-5.3-Flash (agent)** inside OpenCode performed the implementation:
  scaffolding, code generation, debugging, test writing, documentation.

## Where AI accelerated the work

- Project scaffolding (Next.js + TS + Tailwind 4 + Tiptap 3 + postgres.js) and
  configuration files (tsconfig, postcss, vitest, eslint flat config).
- Authorization design: the pure policy module (`src/lib/authz.ts`) plus its
  enforcement pattern (PermissionContext resolved in every route handler), and
  the unit/integration test suites around it.
- The zero-dependency `.md`/`.txt` → ProseMirror converter — including its test
  suite, which caught several edge cases (list grouping, title stripping).
- Writing the migration SQL constraints (unique share, role CHECK,
  owner-share trigger) and the seeded-account mechanism.
- Cloud/browser verification loops: driving the actual UI (login, create,
  type, autosave persistence check in Postgres, share grant, viewer
  read-only experience) to validate what tests could not.

## Deployment-phase session facts

- Vercel CLI (authenticated) was used to: link the project (`ajaia-docs`),
  connect the GitHub repository, and pull project settings.
- `vercel build --prod` locally fails with `EPERM ... symlink` — a Windows
  symlink-permission limitation of the local machine, not a project issue;
  the same project passes `next build`, which is what Vercel's remote builder
  runs. Treated as a local-only pre-flight limitation.
- Marketplace Postgres (Neon/Supabase) installation is gated by Vercel behind
  an interactive browser terms-acceptance (non-interactive CLI returns
  `integration_terms_acceptance_required`). The live deployment is therefore
  executed by the repository owner; exact steps are in README.md. No
  deployment URL was fabricated.
- Source was pushed to GitHub
  (`https://github.com/Bhawana0218/AJAIA-ai-native-document-editor.git`).

## Output changed or rejected

- The import endpoint originally spread a per-provider JSON type (`sql.json`)
  that didn't typecheck under `postgres.js`'s `export =` typings; replaced with
  plain `JSON.stringify(...)::jsonb` casts.
- One codemod attempt to rewrite import paths silently did nothing (regex
  missing the `/` after `@`); diagnosed with a small debug script and fixed.
- `next lint` (built into Next 15) collided with the pinned ESLint 9 +
  eslint-config-next 16; resolved by pinning `eslint-config-next@15.5.28` and
  moving to the ESLint CLI (`eslint .`) with FlatCompat.
- StarterKit v3 already bundles Underline and Link — an explicit duplicate
  `Underline` extension was removed after checking the package source.
- A first-draft GET route in `documents/[id]` had an accidental ambiguous
  `select id` column (SQL error 42702 on joins) — found during manual HTTP
  verification and fixed to qualify columns (`d.id`).
- The autosave retry path initially rescheduled saves in an unbounded loop on
  persistent failure (flushed out by a manual test that killed the server
  mid-save); replaced with bounded backoff (≤3 attempts).

## How correctness was verified

- `npm test` — 28 Vitest tests (authorization policy units; DB-backed
  integration covering owner/editor/viewer/unrelated roles and the
  share-with-owner trigger; import converter).
- `npm run typecheck` (tsc strict) and `npm run lint` (ESLint) — clean.
- `npm run build` production build passes.
- HTTP-level permission matrix verification against the running production
  build (status codes for owner/editor/viewer/unrelated/case-malformed IDs):
  documented in SUBMISSION.md.
- Manual end-to-end UI verification via an automated browser: login, dashboard
  tabs/counts, document creation, keyboard typing with bold + H2 toolbar
  toggles, autosave state ("Saved", verified content persisted in Postgres with
  the bold mark), share grant through the dialog, and the viewer's read-only
  editor experience.
- What remains unverified is stated plainly in SUBMISSION.md (notably actual
  cloud deployment).
