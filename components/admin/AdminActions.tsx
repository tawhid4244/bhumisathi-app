"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AccountRow } from "@/lib/engines/office";
import { useLang } from "../i18n/LangProvider";

const ROLE: Record<string, { bn: string; en: string }> = {
  citizen: { bn: "নাগরিক", en: "Citizen" },
  officer: { bn: "কর্মকর্তা", en: "Officer" },
  admin: { bn: "প্রশাসক", en: "Admin" },
};

export function AccountsTable({ accounts }: { accounts: AccountRow[] }) {
  const router = useRouter();
  const { t } = useLang();
  const [msg, setMsg] = useState<{ bn: string; en: string } | null>(null);

  async function unlock(email: string) {
    const res = await fetch("/api/admin/unlock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setMsg(
      res.ok
        ? { bn: "অ্যাকাউন্ট খুলে দেওয়া হয়েছে।", en: "The account is unlocked." }
        : { bn: "খোলা যায়নি।", en: "Could not unlock." },
    );
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">{t("অ্যাকাউন্ট", "Accounts")}</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm" data-testid="accounts">
          <caption className="sr-only">{t("অ্যাকাউন্টের তালিকা", "List of accounts")}</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-2">
                {t("নাম", "Name")}
              </th>
              <th scope="col" className="py-2 pr-2">
                {t("ইমেইল", "Email")}
              </th>
              <th scope="col" className="py-2 pr-2">
                {t("ভূমিকা", "Role")}
              </th>
              <th scope="col" className="py-2 pr-2">
                {t("অবস্থা", "Status")}
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
                <td className="py-2 pr-2">
                  {ROLE[a.role] ? t(ROLE[a.role]!.bn, ROLE[a.role]!.en) : a.role}
                </td>
                <td className="py-2 pr-2">
                  {a.locked ? (
                    <button
                      type="button"
                      onClick={() => void unlock(a.email)}
                      className="min-h-11 rounded-lg border border-verdict-red px-2 text-verdict-red"
                    >
                      {t("লক — খুলে দিন", "Locked — unlock")}
                    </button>
                  ) : (
                    t("সক্রিয়", "Active")
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg ? <p role="status">{t(msg.bn, msg.en)}</p> : null}
      <p className="text-xs text-ink-soft">
        {t(
          "পাসওয়ার্ড কখনও দেখানো হয় না; শুধু তার হ্যাশ সংরক্ষিত থাকে।",
          "Passwords are never shown; only their hash is stored.",
        )}
      </p>
    </div>
  );
}

export function ResetDemoButton() {
  const router = useRouter();
  const { t } = useLang();
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
        {busy ? t("রিসেট হচ্ছে…", "Resetting…") : t("ডেমো রিসেট", "Reset demo")}
      </button>
      {done ? <p role="status">{t("ডেমো নতুন করে শুরু হয়েছে।", "The demo has restarted.")}</p> : null}
    </div>
  );
}
