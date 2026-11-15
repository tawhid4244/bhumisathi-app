"use client";

import { useState } from "react";
import { Bi, useLang } from "../i18n/LangProvider";

// Email + password. The password goes only to our own /api/auth/login over HTTPS; the session
// cookie it sets is httpOnly, so no script on the page can read it.
type Msg = { bn: string; en: string };
const MESSAGES: Record<string, Msg> = {
  invalid: { bn: "ইমেইল বা পাসওয়ার্ড সঠিক নয়।", en: "Wrong email or password." },
  locked: { bn: "অনেকবার ভুল পাসওয়ার্ড। ১৫ মিনিট পরে আবার চেষ্টা করুন।", en: "Too many wrong passwords. Try again in 15 minutes." }, // prettier-ignore
  limited: { bn: "অনেক বেশি চেষ্টা হয়েছে। এক মিনিট পরে আবার চেষ্টা করুন।", en: "Too many attempts. Try again in a minute." }, // prettier-ignore
  missing: { bn: "ইমেইল ও পাসওয়ার্ড দিন।", en: "Enter your email and password." },
};

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [error, setError] = useState<Msg | null>(
    initialError ? (MESSAGES[initialError] ?? null) : null,
  );
  const [busy, setBusy] = useState(false);
  const { t, lang } = useLang();

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
        setError({ bn: json?.error?.bn ?? "লগইন করা যায়নি।", en: json?.error?.en ?? "Could not sign in." }); // prettier-ignore
        return;
      }
      // A full page load, not router.replace: the router may hold a prefetched copy of the
      // page from before sign-in (a redirect to /login), which would send the user back here.
      window.location.assign(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    // method/action: if the button is pressed before JavaScript has loaded, the browser still
    // POSTs to the login API (never a GET, which would put the password in the address).
    <form
      method="post"
      action="/api/auth/login"
      onSubmit={submit}
      className="space-y-4"
      aria-describedby={error ? "login-error" : undefined}
    >
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="font-medium">
          <Bi bn="ইমেইল" en="Email" />
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
          <Bi bn="পাসওয়ার্ড" en="Password" />
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
          {lang === "en" ? error.en : error.bn}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="min-h-12 w-full rounded-lg bg-brand px-4 font-semibold text-white disabled:opacity-60"
      >
        {busy ? t("অপেক্ষা করুন…", "Please wait…") : t("লগইন করুন", "Sign in")}
      </button>
    </form>
  );
}
