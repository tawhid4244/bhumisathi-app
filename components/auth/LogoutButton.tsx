"use client";

import { T } from "../i18n/LangProvider";

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        // Full page load on purpose: drop every page the router cached while signed in.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/");
      }}
      className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-verdict-red hover:bg-red-50"
    >
      <T bn="লগআউট" en="Sign out" />
    </button>
  );
}
