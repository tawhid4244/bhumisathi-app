"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AccountRow } from "@/lib/engines/office";

const ROLE_BN: Record<string, string> = { citizen: "নাগরিক", officer: "কর্মকর্তা", admin: "প্রশাসক" };

export function AccountsTable({ accounts }: { accounts: AccountRow[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  async function unlock(email: string) {
    const res = await fetch("/api/admin/unlock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setMsg(res.ok ? "অ্যাকাউন্ট খুলে দেওয়া হয়েছে।" : "খোলা যায়নি।");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">অ্যাকাউন্ট</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm" data-testid="accounts">
          <caption className="sr-only">অ্যাকাউন্টের তালিকা</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-2">
                নাম
              </th>
              <th scope="col" className="py-2 pr-2">
                ইমেইল
              </th>
              <th scope="col" className="py-2 pr-2">
                ভূমিকা
              </th>
              <th scope="col" className="py-2 pr-2">
                অবস্থা
              </th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.email} className="border-b border-line/60">
                <td className="py-2 pr-2">{a.name_bn}</td>
                <td lang="en" className="break-all py-2 pr-2 font-mono text-xs">
                  {a.email}
                </td>
                <td className="py-2 pr-2">{ROLE_BN[a.role] ?? a.role}</td>
                <td className="py-2 pr-2">
                  {a.locked ? (
                    <button
                      type="button"
                      onClick={() => void unlock(a.email)}
                      className="min-h-11 rounded-lg border border-verdict-red px-2 text-verdict-red"
                    >
                      লক — খুলে দিন
                    </button>
                  ) : (
                    "সক্রিয়"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg ? <p role="status">{msg}</p> : null}
      <p className="text-xs text-ink-soft">পাসওয়ার্ড কখনও দেখানো হয় না; শুধু তার হ্যাশ সংরক্ষিত থাকে।</p>
    </div>
  );
}

export function ResetDemoButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await fetch("/api/demo/reset", { method: "POST" });
          setBusy(false);
          setDone(res.ok);
          router.refresh();
        }}
        className="min-h-11 rounded-lg border border-line bg-paper px-3 font-medium disabled:opacity-60"
      >
        {busy ? "রিসেট হচ্ছে…" : "ডেমো রিসেট"}
      </button>
      {done ? <p role="status">ডেমো নতুন করে শুরু হয়েছে।</p> : null}
    </div>
  );
}
