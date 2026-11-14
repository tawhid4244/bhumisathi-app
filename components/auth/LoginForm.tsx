"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Email + password. The password goes only to our own /api/auth/login over HTTPS; the session
// cookie it sets is httpOnly, so no script on the page can read it.
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error?.bn ?? "লগইন করা যায়নি।");
        return;
      }
      router.replace(next);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4"
      aria-describedby={error ? "login-error" : undefined}
    >
      <label className="block">
        <span className="font-medium">
          ইমেইল{" "}
          <span lang="en" className="text-sm text-ink-soft">
            Email
          </span>
        </span>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          className="mt-1 w-full min-w-0 rounded-lg border border-line px-3 py-3"
        />
      </label>
      <label className="block">
        <span className="font-medium">
          পাসওয়ার্ড{" "}
          <span lang="en" className="text-sm text-ink-soft">
            Password
          </span>
        </span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full min-w-0 rounded-lg border border-line px-3 py-3"
        />
      </label>
      {error ? (
        <p id="login-error" role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="min-h-12 w-full rounded-lg bg-brand px-4 font-semibold text-white disabled:opacity-60"
      >
        {busy ? "অপেক্ষা করুন…" : "লগইন করুন"}
      </button>
    </form>
  );
}
