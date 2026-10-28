# Screenshots — capture instructions

Automated screenshots are not possible in this environment (the browser runs
without a visible desktop window). Capture them manually from the deployed
production URL — takes ~2 minutes with the Snipping Tool (Win+Shift+S) or a
full-window screenshot (Win+Alt+PrtScn).

Save into this folder using these exact names, then the README links become valid:

| File | What to capture | Where |
| --- | --- | --- |
| `01-dashboard.png` | Dashboard, "My Documents" tab showing seeded cards (alice@demo.dev) | `/dashboard` |
| `02-editor.png` | Editor with formatted content (heading + bold + bullet list) and the "Saved" indicator | any owned document |
| `03-share-dialog.png` | Share dialog with collaborator list and role select | owned document → Share |
| `04-viewer-readonly.png` | Viewer's read-only editor (amber banner, disabled toolbar) | carol@demo.dev → "Meeting Notes — Kickoff" |
| `05-shared-with-me.png` | "Shared with Me" tab as carol@demo.dev | `/dashboard` |

Rules: no `.env`, DB strings, or secrets on screen; the demo password
`demo1234` may be visible only on the login page. After capture, update
README.md to reference `screenshots/01-dashboard.png` etc.
