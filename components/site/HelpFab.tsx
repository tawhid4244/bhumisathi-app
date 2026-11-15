"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "../i18n/LangProvider";
import { IconChat } from "../ui/icons";

// Floating "Ask Sathi" button (like a portal's live-chat bubble). Hidden on the chat page itself.
export function HelpFab() {
  const path = usePathname();
  const { t } = useLang();
  if (path === "/chat" || path === "/judge") return null;
  return (
    <Link
      href="/chat"
      aria-label={t("সাথীকে জিজ্ঞাসা করুন", "Ask Sathi")}
      className="animate-float fixed bottom-4 right-4 z-30 inline-flex h-14 w-14 items-center justify-center gap-2 rounded-full bg-brand font-semibold text-white shadow-lg ring-4 ring-white/70 transition-colors hover:bg-brand-deep sm:h-auto sm:min-h-12 sm:w-auto sm:px-4"
    >
      <IconChat className="h-6 w-6 sm:h-5 sm:w-5" />
      {/* Phones: a round icon button (does not cover the page); wider screens: with text. */}
      <span className="hidden sm:inline" aria-hidden="true">
        {t("সাথীকে জিজ্ঞাসা করুন", "Ask Sathi")}
      </span>
    </Link>
  );
}
