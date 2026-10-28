# Ajaia Docs — Walkthrough Recording Script (3–5 min)

Record against the deployed production URL (see SUBMISSION.md). Use the seeded
demo accounts; both documents and shares used below already exist out of the box.
Screen recording: OBS/Windows Game Bar (Win+Alt+R) at 1080p. Browser zoom 100%.

## 0:00–0:30 — Introduction and scope
- **On screen:** open the production URL on the login page; click the "Bob — editor" quick sign-in.
- **Say:** "This is Ajaia Docs — a collaborative document editor built for the Ajaia
  assignment. Next.js 15, TypeScript, Tailwind, Tiptap on PostgreSQL. Within the
  timebox it covers real persistence, enforced sharing permissions, autosave,
  and file import. Three seeded accounts let a reviewer verify permission
  behavior immediately."

## 0:30–1:30 — Create, edit, format, save, reopen
- **On screen:** from the dashboard click "New document"; type a title.
- Click into the body and show the toolbar: select some typed text and apply
  **Bold**, then start a **Bullet list** item.
- **On screen cue:** point at the *"Saving… → Saved"* indicator in the editor header.
- **Say:** "Changes autosave after a short debounce — you can see the status.
  Unsaved changes are also protected: closing the tab warns first."
-**On screen:** navigate back to the dashboard, reopen the document, showing the
  content reloaded from the database. "It's really persisted — this is Postgres, not localStorage."

## 1:30–2:15 — Import + sharing
- **On screen:** back on the dashboard, click "Import .txt/.md", pick a small `.md`
  file (one prepared in advance: headings + bullets). The editor opens on the
  imported document with formatting preserved.
- Then open the editor's "Share" button on any owned document; show the dialog.
- **Say:** "Import converts Markdown server-side into the editor's native format.
  Sharing grants Viewer or Editor to registered users; duplicate invitations
  collapse into a single share per person."

## 2:15–3:15 — Role restrictions, persistence, test evidence
- **On screen:** sign out; sign in as **carol@demo.dev** (viewer).
- Open "Meeting Notes — Kickoff" — show the read-only banner and the disabled toolbar.
- **Say:** "Carol is a viewer: the title isn't editable, the toolbar is disabled,
  and the API itself returns 403 for edits — the UI is not the security boundary."
- **On screen (optional):** show terminal running `npm test` with the passing
  authorization tests (owner / editor / viewer / unrelated 404 matrix).
- **Say:** "28 automated tests cover the authorization policy, the database
  integration, and the import pipeline. Unrelated users get a 404 — document IDs
  can't be probed."

## 3:15–4:00 — Architecture, AI assistance, tradeoffs
- **Say (over dashboard or ARCHITECTURE.md on screen):**
  "Architecture: Next.js App Router with server-side authorization on every
  route, Postgres via postgres.js, ProseMirror JSON stored in jsonb, and SQL
  migrations with constraints and triggers. AI accelerated the scaffolding,
  policy layer, parser, and tests — every AI-generated piece was verified by
  running the real tests and a live browser session; several generations were
  changed or rejected, documented in AI_WORKFLOW.md. Deferred: real-time
  co-editing, self-serve registration."
- **End screen:** SUBMISSION.md reviewer credentials section.

### Recorded-session checklist (verify before sharing)
- [ ] Production URL is the one shown in SUBMISSION.md
- [ ] No `.env`, passwords, or DB connection strings appear on screen
- [ ] Demo password `demo1234` shown only where reviewers are expected to see it
- [ ] Video ≤ 5 minutes; upload, then put the REAL URL into WALKTHROUGH_URL.txt
