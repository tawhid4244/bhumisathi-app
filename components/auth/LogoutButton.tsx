"use client";

import { useRouter } from "next/navigation";
import { T } from "../i18n/LangProvider";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/");
        router.refresh();
      }}
      className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-verdict-red hover:bg-red-50"
    >
      <T bn="লগআউট" en="Sign out" />
    </button>
  );
}
