"use client";

import { useEffect, useState } from "react";
import { Modal, TextInput, PrimaryButton, SecondaryButton, Spinner } from "@/components/ui";

export type RenameTarget = { id: string; title: string } | null;

export function RenameDialog({
  target,
  onClose,
  onSave,
}: {
  target: RenameTarget;
  onClose: () => void;
    onSave: (id: string, newTitle: string) => Promise<string | null>;
}) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      setTitle(target.title === "Untitled" ? "" : target.title);
      setError(null);
    }
  }, [target]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!target) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title cannot be empty");
      return;
    }
    setBusy(true);
    setError(null);
    const err = await onSave(target.id, trimmed);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    onClose();
  }

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title="Rename document"
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={busy}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={() => void submit()} disabled={busy}>
            {busy ? <Spinner /> : null}
            Save
          </PrimaryButton>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-1">
        <label htmlFor="rename-title" className="block text-xs font-medium text-ink-600">
          Document title
        </label>
        <TextInput
          id="rename-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Untitled"
        />
        {error ? (
          <p role="alert" className="pt-1 text-xs text-rose-700">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
