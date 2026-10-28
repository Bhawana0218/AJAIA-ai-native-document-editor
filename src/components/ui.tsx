"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "@/components/icons";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
    footer?: React.ReactNode;
};

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input, button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const portalTarget = typeof document !== "undefined" ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-xl bg-canvas shadow-xl ring-1 ring-zinc-200"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded p-1 text-ink-400 hover:bg-zinc-100 hover:text-ink-900"
          >
            <XIcon size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-3">{footer}</div>
        ) : null}
      </div>
    </div>,
    portalTarget,
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-canvas px-3.5 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function TextInput({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none transition-colors placeholder:text-ink-400 focus:border-accent-600 ${className}`}
      {...props}
    />
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-medium text-accent-700">
      {children}
    </span>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="animate-spin text-accent-600"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" fill="none" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}
