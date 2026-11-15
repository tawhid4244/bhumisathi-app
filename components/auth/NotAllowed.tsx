import Link from "next/link";
import { ROLE_BN, type Role } from "@/lib/auth/roles";
import { Bi, T } from "../i18n/LangProvider";

// Shown when a signed-in user opens a page their role may not use.
export function NotAllowed({ need }: { need: Role }) {
  return (
    <div
      role="alert"
      data-testid="not-allowed"
      className="rounded-xl border border-amber-300 bg-amber-50 p-4"
    >
      <p className="font-semibold">
        <Bi
          bn={`এই পাতাটি শুধু ${ROLE_BN[need]}দের জন্য।`}
          en={`This page is for the ${need} role only.`}
          sub="text-sm font-normal text-ink-soft"
          block
        />
      </p>
      <Link href="/" className="mt-2 inline-flex min-h-11 items-center underline">
        <T bn="হোমে ফিরে যান" en="Back to home" />
      </Link>
    </div>
  );
}
