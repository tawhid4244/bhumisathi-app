import Link from "next/link";
import { currentUser } from "@/lib/auth/current";
import { unreadCount } from "@/lib/engines/applications";
import { T } from "../i18n/LangProvider";
import { LogoutButton } from "./LogoutButton";

const ROLE = {
  citizen: { bn: "নাগরিক", en: "Citizen" },
  officer: { bn: "কর্মকর্তা", en: "Officer" },
  admin: { bn: "প্রশাসক", en: "Admin" },
} as const;

// Sign-in pill, or the signed-in person's menu (name, role, their pages, sign out).
export async function UserBar() {
  const user = await currentUser();
  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex min-h-9 items-center rounded-full bg-brand px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-deep"
      >
        <T bn="লগইন" en="Sign in" />
      </Link>
    );
  }
  const initial = [...user.name_bn.trim()][0] ?? "•";
  const unread = await unreadCount(user).catch(() => 0);
  return (
    <details className="group relative" data-testid="user-bar">
      <summary
        aria-label={`${user.name_bn} — অ্যাকাউন্ট / Account`}
        className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-full border border-line bg-card p-1 sm:pr-3 text-sm hover:border-brand [&::-webkit-details-marker]:hidden"
      >
        <span
          className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm font-bold text-white"
          aria-hidden="true"
        >
          {initial}
          {unread > 0 ? (
            <span
              className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-verdict-red"
              data-testid="bell-dot"
            />
          ) : null}
        </span>
        <span className="hidden max-w-36 truncate sm:inline">{user.name_bn}</span>
        <span className="hidden rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-deep sm:inline">
          <T bn={ROLE[user.role].bn} en={ROLE[user.role].en} />
        </span>
      </summary>
      <div className="animate-fade-up absolute right-0 z-50 mt-2 w-64 rounded-xl border border-line bg-card p-2 shadow-xl">
        <p className="px-3 py-2 text-sm">
          <span className="block font-semibold">{user.name_bn}</span>
          <span className="block text-xs font-semibold text-brand-deep">
            <T bn={ROLE[user.role].bn} en={ROLE[user.role].en} />
          </span>
          <span lang="en" className="block truncate text-xs text-ink-soft">
            {user.email}
          </span>
        </p>
        <div className="my-1 border-t border-line" />
        <Link
          href="/my"
          className="flex min-h-11 items-center justify-between rounded-lg px-3 hover:bg-brand-soft"
        >
          <T bn="আমার সেবা" en="My services" />
          {unread > 0 ? (
            <span className="rounded-full bg-verdict-red px-2 py-0.5 text-xs font-semibold text-white">
              {unread}
            </span>
          ) : null}
        </Link>
        {user.role !== "citizen" ? (
          <Link
            href="/inbox"
            className="flex min-h-11 items-center rounded-lg px-3 hover:bg-brand-soft"
          >
            <T bn="ইনবক্স" en="Inbox" />
          </Link>
        ) : null}
        {user.role !== "citizen" ? (
          <Link
            href="/admin"
            className="flex min-h-11 items-center rounded-lg px-3 hover:bg-brand-soft"
          >
            <T bn="অফিস" en="Office" />
          </Link>
        ) : null}
        {user.owner_id ? (
          <Link
            href="/my-land"
            className="flex min-h-11 items-center rounded-lg px-3 hover:bg-brand-soft"
          >
            <T bn="আমার জমি" en="My land" />
          </Link>
        ) : null}
        <LogoutButton />
      </div>
    </details>
  );
}
