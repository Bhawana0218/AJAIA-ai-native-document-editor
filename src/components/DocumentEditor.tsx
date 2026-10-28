"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorToolbar, ViewerNotice } from "@/components/EditorToolbar";
import { ShareDialog, type Share } from "@/components/ShareDialog";
import {
  DangerButton,
  Modal,
  SecondaryButton,
  Spinner,
  timeAgo,
} from "@/components/ui";
import {
  CheckIcon,
  DocIcon,
  ErrorIcon,
  LogoutIcon,
  ShareIcon,
  TrashIcon,
} from "@/components/icons";
import { RenameDialog } from "@/components/dialogs";

export type EditorDoc = {
  id: string;
  title: string;
  content: object;
  ownerName: string;
  updatedAt: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function DocumentEditor({
  doc,
  role,
  user,
  canManage,
  initialShares,
}: {
  doc: EditorDoc;
  role: "owner" | "editor" | "viewer";
  user: { id: string; name: string };
  canManage: boolean;
  initialShares: Share[];
}) {
  const router = useRouter();
  const canEdit = role === "owner" || role === "editor";

  // ---- autosave state ----
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(doc.updatedAt);
  const [title, setTitle] = useState(doc.title);
  const dirtyRef = useRef(false); // has unsaved changes?
  const savingRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<{ title: string; content: object }>({
    title: doc.title,
    content: doc.content,
  });
  const attemptsRef = useRef(0);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          // H1-H4 supported; toolbar exposes H1-H3
          heading: { levels: [1, 2, 3, 4] },
        }),
        Placeholder.configure({
          placeholder: "Start writing, or use the toolbar to add headings and lists…",
        }),
      ],
      content: doc.content,
      editable: canEdit,
      editorProps: {
        attributes: {
          id: "document-editor",
          class: "focus:outline-none",
          "aria-label": "Document body",
          spellcheck: "true",
        },
      },
      onUpdate: ({ editor: e }) => {
        latestRef.current = { ...latestRef.current, content: e.getJSON() };
        scheduleSave();
      },
      immediatelyRender: false,
    },
    [canEdit],
  );

  const performSave = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setStatus("saving");
    let failed = false;
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          ...(role === "owner" ? { title: latestRef.current.title } : {}),
          content: latestRef.current.content,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Save failed (${res.status})`);
      }
      dirtyRef.current = false;
      attemptsRef.current = 0;
      setStatus("saved");
      setSavedAt(new Date().toISOString());
    } catch (err) {
      console.error("Autosave failed:", err);
      failed = true;
      setStatus("error");
    } finally {
      savingRef.current = false;
      // On failure, retry with bounded backoff (max 3 attempts) instead of
      // an unbounded tight loop; a subsequent edit always reschedules.
      if (dirtyRef.current && failed && attemptsRef.current < 3) {
        attemptsRef.current += 1;
        setTimeout(() => scheduleSaveRef.current(), 3000);
      }
    }
  }, [doc.id, role]);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    setStatus((s) => (s === "saving" ? s : "idle"));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void performSave(), 1200);
  }, [performSave]);
  const scheduleSaveRef = useRef(scheduleSave);
  scheduleSaveRef.current = scheduleSave;

  // Warn on unload / flush pending changes when the tab is hidden.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && dirtyRef.current) {
        void performSave();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [performSave]);

  // ---- title edits (owner only) ----
  function onTitleChange(value: string) {
    setTitle(value);
    latestRef.current = { ...latestRef.current, title: value };
    scheduleSave();
  }

  // ---- dialogs ----
  const [shareOpen, setShareOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleRename(newTitle: string): Promise<string | null> {
    latestRef.current = { ...latestRef.current, title: newTitle };
    setTitle(newTitle);
    // save immediately via same patch channel
    const res = await fetch(`/api/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.error ?? "Rename failed";
    }
    dirtyRef.current = false;
    setStatus("saved");
    setSavedAt(new Date().toISOString());
    return null;
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setDeleting(false);
      setStatus("error");
      setDeleteOpen(false);
    }
  }

  async function signOut() {
    if (dirtyRef.current) await performSave();
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <main className="flex min-h-dvh flex-col bg-subtle">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-canvas">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/dashboard"
              aria-label="Back to dashboard"
              className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-ink-600 transition-colors hover:bg-zinc-100 hover:text-ink-900"
            >
              <DocIcon size={16} />
              <span className="hidden sm:inline">All documents</span>
            </Link>
            <span className="hidden h-5 w-px bg-zinc-200 sm:block" aria-hidden="true" />
            <p className="min-w-0 truncate text-xs text-ink-400">
              {role === "owner" ? "You own this document" : `Shared by ${doc.ownerName}`} ·
              last saved {savedAt ? timeAgo(savedAt) : "never"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-xs text-ink-600 sm:block">{user.name}</span>
            {canManage ? (
              <SecondaryButton onClick={() => setShareOpen(true)} aria-label="Open share dialog">
                <ShareIcon size={14} />
                Share
              </SecondaryButton>
            ) : (
              <SecondaryButton onClick={() => setShareOpen(true)} aria-label="Open share dialog">
                <ShareIcon size={14} />
                People
              </SecondaryButton>
            )}
            {canManage ? (
              <>
                <button
                  type="button"
                  onClick={() => setRenameOpen(true)}
                  className="rounded-lg border border-zinc-200 px-2.5 py-2 text-xs text-ink-600 transition-colors hover:bg-zinc-50"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteOpen(true)}
                  aria-label="Delete document"
                  title="Delete document"
                  className="rounded-lg border border-zinc-200 px-2.5 py-2 text-xs text-ink-600 transition-colors hover:bg-rose-50 hover:text-rose-600"
                >
                  <TrashIcon size={14} />
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => void signOut()}
              aria-label="Sign out"
              title="Sign out"
              className="rounded-lg border border-zinc-200 px-2.5 py-2 text-xs text-ink-600 transition-colors hover:bg-zinc-50"
            >
              <LogoutIcon size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Editor surface */}
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 pb-24">
        <div className="mt-8 rounded-xl border border-zinc-200 bg-canvas shadow-sm">
          {/* Title row */}
          <div className="border-b border-zinc-100 px-6 pt-6 pb-4 sm:px-10">
            {canManage ? (
              <input
                type="text"
                value={title}
                maxLength={120}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Untitled"
                aria-label="Document title"
                className="w-full bg-transparent text-[1.75rem] font-semibold tracking-tight text-ink-900 outline-none placeholder:text-ink-400"
              />
            ) : (
              <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink-900">
                {title}
              </h1>
            )}
            <p className="mt-1 text-xs text-ink-400">
              {canEdit ? "Changes save automatically" : "Read-only"} ·{" "}
              {new Date(doc.updatedAt).toLocaleString()}
            </p>
          </div>

          {/* Toolbar + save status */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-canvas/95 px-4 py-2 backdrop-blur sm:px-8">
            <EditorToolbar editor={canEdit ? editor : null} />
            <SaveStatusIndicator status={status} />
          </div>

          {role === "viewer" ? (
            <div className="px-4 pb-2 sm:px-8">
              <ViewerNotice ownerName={doc.ownerName} />
            </div>
          ) : null}

          {/* Body */}
          <div className="px-6 pb-16 pt-2 sm:px-10">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        documentId={doc.id}
        canManage={canManage}
        initialShares={initialShares}
      />
      <RenameDialog target={renameOpen ? { id: doc.id, title } : null} onClose={() => setRenameOpen(false)} onSave={handleRename} />
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete document"
        footer={
          <>
            <SecondaryButton onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </SecondaryButton>
            <DangerButton onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? <Spinner /> : <TrashIcon size={14} />}
              Delete permanently
            </DangerButton>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          Permanently delete “{title}”? Everyone it was shared with will lose access. This cannot
          be undone.
        </p>
      </Modal>
    </main>
  );
}

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-ink-600" role="status">
        <Spinner size={13} />
        Saving…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-emerald-600" role="status">
        <CheckIcon size={13} />
        Saved
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-rose-600" role="alert">
        <ErrorIcon size={13} />
        Save failed — retrying on next edit
        <button
          type="button"
          className="underline decoration-rose-300"
          onClick={() => location.reload()}
        >
          reload
        </button>
      </span>
    );
  }
  return <span className="w-12 shrink-0" aria-hidden="true" />;
}
