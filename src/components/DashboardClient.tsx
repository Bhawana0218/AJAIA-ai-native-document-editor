"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Badge,
  Modal,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  TextInput,
  Spinner,
  timeAgo,
} from "@/components/ui";
import {
  DocIcon,
  ErrorIcon,
  LogoutIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  ShareIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/icons";
import { RenameDialog } from "@/components/dialogs";

export type DocumentCard = {
  id: string;
  title: string;
  role: "owner" | "editor" | "viewer";
  ownerName: string;
  updatedAt: string;
};

type Tab = "mine" | "shared";

const IMPORT_EXTENSIONS = [".txt", ".md"];

export function DashboardClient({
  user,
  initialDocuments,
}: {
  user: { id: string; name: string; email: string };
  initialDocuments: DocumentCard[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("mine");
  const [query, setQuery] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DocumentCard | null>(null);
  const [renameTarget, setRenameTarget] = useState<DocumentCard | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mine = useMemo(() => initialDocuments.filter((d) => d.role === "owner"), [initialDocuments]);
  const shared = useMemo(
    () => initialDocuments.filter((d) => d.role !== "owner"),
    [initialDocuments],
  );
  const visible = useMemo(() => {
    const list = tab === "mine" ? mine : shared;
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((d) => d.title.toLowerCase().includes(q));
  }, [tab, mine, shared, query]);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function createDocument() {
    setCreating(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Create failed");
      const doc = await res.json();
      router.push(`/docs/${doc.id}`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to create document");
      setCreating(false);
    }
  }

  async function onImportFile(file: File) {
    setImportError(null);
    const ext = `.${file.name.toLowerCase().split(".").pop() ?? ""}`;
    if (!IMPORT_EXTENSIONS.includes(ext)) {
      setImportError(
        `"${file.name}" is not supported. Only .txt and .md files can be imported.`,
      );
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      const res = await fetch("/api/documents/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      router.push(`/docs/${data.id}`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
      setImporting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setBusyIds((s) => new Set(s).add(id));
    setDeleteTarget(null);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Delete failed");
      refresh();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }

  async function saveRename(id: string, newTitle: string) {
    setBusyIds((s) => new Set(s).add(id));
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Rename failed");
      refresh();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Rename failed";
    } finally {
      setBusyIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const emptyState = (
    <EmptyState
      tab={tab}
      hasQuery={query.trim().length > 0}
      onCreate={createDocument}
      onImportClick={() => fileInputRef.current?.click()}
      creating={creating}
      importing={importing}
    />
  );

  return (
    <main className="min-h-dvh bg-subtle">
      {}
      <header className="border-b border-zinc-200 bg-canvas">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-600 text-white">
              <DocIcon size={15} />
            </span>
            <span className="text-[15px]">Ajaia Docs</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-ink-600 sm:block">
              {user.name} · {user.email}
            </span>
            <button
              type="button"
              onClick={signOut}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:bg-zinc-50"
            >
              <LogoutIcon size={14} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {tab === "mine" ? "My Documents" : "Shared with Me"}
            </h1>
            <p className="mt-0.5 text-sm text-ink-600">
              {tab === "mine"
                ? `${mine.length} document${mine.length === 1 ? "" : "s"} you own`
                : `${shared.length} document${shared.length === 1 ? "" : "s"} shared with you`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={IMPORT_EXTENSIONS.join(",")}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImportFile(f);
                e.target.value = "";
              }}
            />
            <SecondaryButton
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              aria-label="Import a .txt or .md file"
            >
              {importing ? <Spinner /> : <UploadIcon size={15} />}
              Import .txt/.md
            </SecondaryButton>
            <PrimaryButton onClick={createDocument} disabled={creating}>
              {creating ? <Spinner /> : <PlusIcon size={15} />}
              New document
            </PrimaryButton>
          </div>
        </div>

        {importError ? (
          <p
            role="alert"
            className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700"
          >
            <ErrorIcon size={16} />
            {importError}
            <button
              type="button"
              onClick={() => setImportError(null)}
              className="ml-auto text-xs underline"
            >
              dismiss
            </button>
          </p>
        ) : null}

        {}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <SearchIcon
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400"
            />
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === "mine" ? "Search my documents…" : "Search shared documents…"}
              className="bg-canvas pl-9"
              aria-label="Search documents"
            />
          </div>
          <div
            className="flex rounded-lg border border-zinc-200 bg-canvas p-0.5"
            role="tablist"
            aria-label="Document lists"
          >
            <TabButton active={tab === "mine"} onClick={() => setTab("mine")} count={mine.length}>
              My Documents
            </TabButton>
            <TabButton
              active={tab === "shared"}
              onClick={() => setTab("shared")}
              count={shared.length}
            >
              Shared with Me
            </TabButton>
          </div>
        </div>

        {}
        {visible.length === 0 ? (
          emptyState
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {visible.map((doc) => (
              <li key={doc.id} className="group relative">
                <Link
                  href={`/docs/${doc.id}`}
                  className="block rounded-xl border border-zinc-200 bg-canvas p-4 shadow-sm transition-all hover:border-accent-600 hover:shadow-md"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                      <DocIcon size={17} />
                    </span>
                    <Badge>
                      {doc.role === "owner" ? "Owner" : doc.role === "editor" ? "Editor" : "Viewer"}
                    </Badge>
                  </div>
                  <h3 className="line-clamp-2 text-[15px] font-medium text-ink-900">
                    {doc.title || "Untitled"}
                  </h3>
                  <p className="mt-1 text-xs text-ink-400">
                    {doc.role === "owner" ? "You" : doc.ownerName} · {timeAgo(doc.updatedAt)}
                  </p>
                </Link>
                {}
                {doc.role === "owner" ? (
                  <div className="absolute top-12 right-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <IconAction
                      label="Rename document"
                      onClick={() => setRenameTarget(doc)}
                      busy={busyIds.has(doc.id)}
                    >
                      <PencilIcon size={14} />
                    </IconAction>
                    <IconAction
                      label="Delete document"
                      onClick={() => setDeleteTarget(doc)}
                      busy={busyIds.has(doc.id)}
                    >
                      <TrashIcon size={14} />
                    </IconAction>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete document"
        footer={
          <>
            <SecondaryButton onClick={() => setDeleteTarget(null)}>Cancel</SecondaryButton>
            <DangerButton onClick={confirmDelete}>
              <TrashIcon size={14} />
              Delete
            </DangerButton>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          Permanently delete{" "}
          <span className="font-medium text-ink-900">“{deleteTarget?.title || "Untitled"}”</span>?
          Everyone it was shared with will lose access. This cannot be undone.
        </p>
      </Modal>

      {}
      <RenameDialog
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSave={saveRename}
      />
    </main>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-accent-50 text-accent-700" : "text-ink-600 hover:text-ink-900"
      }`}
    >
      {children}
      <span className="rounded-full bg-zinc-100 px-1.5 text-[10px] text-ink-600">{count}</span>
    </button>
  );
}

function IconAction({
  label,
  onClick,
  busy,
  children,
}: {
  label: string;
  onClick: () => void;
  busy: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={busy}
      className="flex h-7 w-7 items-center justify-center rounded-md bg-canvas text-ink-600 shadow-sm ring-1 ring-zinc-200 transition-colors hover:text-accent-700 disabled:opacity-50"
    >
      {busy ? <Spinner size={13} /> : children}
    </button>
  );
}

function EmptyState({
  tab,
  hasQuery,
  onCreate,
  onImportClick,
  creating,
  importing,
}: {
  tab: Tab;
  hasQuery: boolean;
  onCreate: () => void;
  onImportClick: () => void;
  creating: boolean;
  importing: boolean;
}) {
  if (hasQuery) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-canvas py-16 text-center">
        <SearchIcon size={24} className="mx-auto mb-3 text-ink-400" />
        <p className="text-sm font-medium">No documents match your search</p>
        <p className="mt-1 text-xs text-ink-400">Try a different title.</p>
      </div>
    );
  }
  if (tab === "shared") {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-canvas py-16 text-center">
        <ShareIcon size={24} className="mx-auto mb-3 text-ink-400" />
        <p className="text-sm font-medium">Nothing shared with you yet</p>
        <p className="mt-1 text-xs text-ink-400">
          Documents shared with you by other users will appear here.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-canvas py-16 text-center">
      <DocIcon size={24} className="mx-auto mb-3 text-ink-400" />
      <p className="text-sm font-medium">No documents yet</p>
      <p className="mb-5 mt-1 text-xs text-ink-400">
        Create your first document, or import an existing .txt or .md file.
      </p>
      <div className="flex items-center justify-center gap-2">
        <PrimaryButton onClick={onCreate} disabled={creating}>
          {creating ? <Spinner /> : <PlusIcon size={15} />}
          New document
        </PrimaryButton>
        <SecondaryButton onClick={onImportClick} disabled={importing}>
          {importing ? <Spinner /> : <UploadIcon size={15} />}
          Import file
        </SecondaryButton>
      </div>
    </div>
  );
}
