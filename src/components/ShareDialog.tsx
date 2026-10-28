"use client";

import { useEffect, useState } from "react";
import { Modal, TextInput, PrimaryButton, Badge, Spinner } from "@/components/ui";
import { ErrorIcon, ShareIcon, TrashIcon } from "@/components/icons";

export type Share = {
  id: string;
  recipientId: string;
  recipientName: string;
  recipientEmail: string;
  role: "viewer" | "editor";
};

export function ShareDialog({
  open,
  onClose,
  documentId,
  canManage,
  initialShares,
}: {
  open: boolean;
  onClose: () => void;
  documentId: string;
  canManage: boolean;
  initialShares: Share[];
}) {
  const [shares, setShares] = useState<Share[]>(initialShares);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setShares(initialShares);
      setError(null);
      setNotice(null);
      setEmail("");
      setRole("viewer");
    }
  }, [open, initialShares]);

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to grant access");
        return;
      }
      setShares((prev) => {
        const next = prev.filter((s) => s.recipientId !== data.share.recipientId);
        return [data.share as Share, ...next];
      });
      setNotice(
        `${role === "editor" ? "Editor" : "Viewer"} access granted to ${data.share.recipientEmail}.`,
      );
      setEmail("");
      setRole("viewer");
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(shareId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/shares?shareId=${encodeURIComponent(shareId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to revoke access");
        return;
      }
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Share document">
      <div className="space-y-4">
        {canManage ? (
          <form onSubmit={grant} className="space-y-2">
            <label htmlFor="share-email" className="block text-xs font-medium text-ink-600">
              Grant access by email (registered users only)
            </label>
            <div className="flex gap-2">
              <TextInput
                id="share-email"
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "viewer" | "editor")}
                className="rounded-lg border border-zinc-200 px-2.5 py-2 text-sm outline-none focus:border-accent-600"
                aria-label="Role to grant"
              >
                <option value="viewer">Viewer — read only</option>
                <option value="editor">Editor — can edit</option>
              </select>
              <PrimaryButton type="submit" disabled={busy}>
                {busy ? <Spinner /> : <ShareIcon size={14} />}
                Grant
              </PrimaryButton>
            </div>
          </form>
        ) : (
          <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-ink-600">
            Only the document owner can manage sharing. You can view the current collaborators below.
          </p>
        )}

        {notice ? (
          <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <ErrorIcon size={14} />
            {error}
          </p>
        ) : null}

        <div>
          <p className="mb-2 text-xs font-medium text-ink-600">
            People with access ({shares.length})
          </p>
          {shares.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-3 text-center text-xs text-ink-400">
              Not shared with anyone yet.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200" role="list">
              {shares.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.recipientName}</p>
                    <p className="truncate text-xs text-ink-400">{s.recipientEmail}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge>{s.role === "editor" ? "Editor" : "Viewer"}</Badge>
                    {canManage ? (
                      <button
                        type="button"
                        aria-label={`Revoke access for ${s.recipientEmail}`}
                        title="Revoke access"
                        onClick={() => void revoke(s.id)}
                        disabled={busy}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                      >
                        {busy ? <Spinner size={13} /> : <TrashIcon size={14} />}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
