import Link from "next/link";
import { currentUser } from "@/lib/auth/current";
import { ROLE_BN } from "@/lib/auth/roles";
import { LogoutButton } from "./LogoutButton";

// Top-right of every page: who is signed in (name + role) and a way out, or a sign-in link.
export async function UserBar() {
  const user = await currentUser();
  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm text-white underline-offset-4 hover:underline"
      >
        লগইন{" "}
        <span lang="en" className="ml-1 text-white/70">
          Sign in
        </span>
      </Link>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm" data-testid="user-bar">
      <span className="min-w-0 truncate text-white/90" title={user.email}>
        {user.name_bn}
        <span className="ml-1 rounded bg-white/15 px-1.5 py-0.5 text-xs">{ROLE_BN[user.role]}</span>
      </span>
      <LogoutButton />
    </div>
  );
}
