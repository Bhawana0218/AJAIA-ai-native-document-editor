import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "@/components/LoginForm";
import { DocIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-subtle px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-600 text-white">
            <DocIcon size={22} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Ajaia Docs</h1>
          <p className="text-sm text-ink-600">Sign in to your workspace</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-canvas p-6 shadow-sm">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-ink-400">
          Seeded demo accounts (see README) — password: demo1234
        </p>
      </div>
    </main>
  );
}
