import Link from "next/link";
import { ROLE_BN, type Role } from "@/lib/auth/roles";

// Shown when a signed-in user opens a page their role may not use.
export function NotAllowed({ need }: { need: Role }) {
  return (
    <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <p className="font-semibold">এই পাতাটি শুধু {ROLE_BN[need]}দের জন্য।</p>
      <p lang="en" className="text-sm text-ink-soft">
        This page is for the {need} role only.
      </p>
      <Link href="/" className="mt-2 inline-flex min-h-11 items-center underline">
        হোমে ফিরে যান
      </Link>
    </div>
  );
}
