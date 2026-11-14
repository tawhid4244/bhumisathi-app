"use client";

import { useRouter } from "next/navigation";

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
      className="min-h-11 shrink-0 rounded-lg px-2 text-white underline-offset-4 hover:underline"
    >
      লগআউট
    </button>
  );
}
