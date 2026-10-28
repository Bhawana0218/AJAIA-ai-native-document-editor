"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TextInput, PrimaryButton, Spinner } from "@/components/ui";

const DEMO_ACCOUNTS = [
  { email: "alice@demo.dev", label: "Alice — owner" },
  { email: "bob@demo.dev", label: "Bob — editor" },
  { email: "carol@demo.dev", label: "Carol — viewer" },
];

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent, targetEmail = email, targetPassword = password) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password: targetPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Sign in failed");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={signIn} className="space-y-4" aria-label="Sign in">
      <div className="space-y-1">
        <label htmlFor="email" className="block text-xs font-medium text-ink-600">
          Email
        </label>
        <TextInput
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="block text-xs font-medium text-ink-600">
          Password
        </label>
        <TextInput
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      ) : null}

      <PrimaryButton type="submit" disabled={busy} className="w-full">
        {busy ? <Spinner /> : null}
        {busy ? "Signing in…" : "Sign in"}
      </PrimaryButton>

      <div className="border-t border-zinc-100 pt-3">
        <p className="mb-2 text-[11px] text-ink-400">Quick sign-in (seeded demo accounts):</p>
        <div className="flex flex-wrap gap-1.5">
          {DEMO_ACCOUNTS.map((acct) => (
            <button
              key={acct.email}
              type="button"
              disabled={busy}
              onClick={(e) => signIn(e, acct.email, "demo1234")}
              className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] text-ink-600 transition-colors hover:border-accent-600 hover:text-accent-700 disabled:opacity-50"
            >
              {acct.label}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
