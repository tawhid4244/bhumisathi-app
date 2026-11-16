"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { T, useLang } from "../i18n/LangProvider";
import { IconClose, IconMenu } from "../ui/icons";
import { SERVICES } from "./services";

/** Desktop menu: the main services, with the current page highlighted. */
export function DesktopNav() {
  return <DesktopNavList path={usePathname()} />;
}

/**
 * The menu itself. Also rendered without a current page while the address is not known yet
 * (pages with a dynamic part, like /my/applications/CPY-…, read it later, inside Suspense).
 */
export function DesktopNavList({ path }: { path: string | null }) {
  return (
    <nav aria-label="প্রধান মেনু / Main menu" className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {SERVICES.filter((s) => s.inMenu).map((s) => {
          const active = path === s.href;
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={`relative inline-flex min-h-11 items-center rounded-lg px-3 text-[15px] font-medium transition-colors hover:bg-brand-soft hover:text-brand-deep ${active ? "text-brand-deep" : "text-ink"}`}
              >
                <T bn={s.bn} en={s.en} />
                {active ? (
                  <span
                    className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded bg-brand"
                    aria-hidden="true"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Phone menu: a panel with every service and its one-line hint. */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const { t } = useLang();
  // Close the panel after navigating.
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) {
    setLastPath(path);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={t("মেনু খুলুন", "Open menu")}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-brand-deep hover:bg-brand-soft"
      >
        <IconMenu />
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label={t("মেনু", "Menu")}
        >
          <button
            type="button"
            className="absolute inset-0 bg-ink/50"
            aria-label={t("মেনু বন্ধ করুন", "Close menu")}
            onClick={() => setOpen(false)}
          />
          <div
            id="mobile-menu"
            className="animate-fade-up absolute inset-y-0 right-0 flex w-[min(22rem,88vw)] flex-col overflow-y-auto bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-semibold">{t("সব সেবা", "All services")}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("মেনু বন্ধ করুন", "Close menu")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-brand-soft"
              >
                <IconClose />
              </button>
            </div>
            <ul className="space-y-1 p-3">
              {SERVICES.map((s) => (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    aria-current={path === s.href ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl p-3 hover:bg-brand-soft ${path === s.href ? "bg-brand-soft" : ""}`}
                  >
                    <span
                      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.tint}`}
                    >
                      <s.Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">{t(s.bn, s.en)}</span>
                      <span className="block truncate text-xs text-ink-soft">
                        {t(s.hintBn, s.hintEn)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-auto border-t border-line p-4 text-sm text-ink-soft">
              {t("ভূমিসেবা সহায়তা: ১৬১২২", "Land service helpline: 16122")}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
