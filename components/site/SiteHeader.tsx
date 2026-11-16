import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "../brand/Logo";
import { UserBar } from "../auth/UserBar";
import { LangToggle, T } from "../i18n/LangProvider";
import { DesktopNav, DesktopNavList, MobileMenu } from "./NavLinks";

// Top of every page: a thin flag-green strip, a notice that this is a prototype, then the
// white header with logo, menu, language switch and sign-in (government-portal layout).
export function SiteHeader() {
  return (
    <>
      <div className="h-1.5 bg-brand-deep" aria-hidden="true" />
      <div className="bg-brand-soft text-xs text-brand-deep">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-1.5">
          <p className="min-w-0 truncate">
            <T
              bn="প্রোটোটাইপ · সব তথ্য কাল্পনিক · সরকারি ওয়েবসাইট নয়"
              en="Prototype · all data synthetic · not a government website"
            />
          </p>
          <a href="tel:16122" className="shrink-0 font-semibold underline-offset-2 hover:underline">
            <T bn="সহায়তা ১৬১২২" en="Help 16122" />
          </a>
        </div>
      </div>
      <header className="sticky top-0 z-40 border-b border-line bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
          <Link href="/" className="mr-auto rounded-lg" aria-label="ভূমিসাথী — হোম / Home">
            <Logo />
          </Link>
          <Suspense fallback={<DesktopNavList path={null} />}>
            <DesktopNav />
          </Suspense>
          <LangToggle />
          <Suspense fallback={<span className="inline-block h-9 w-20" />}>
            <UserBar />
          </Suspense>
          <Suspense fallback={<span className="inline-block h-11 w-11 lg:hidden" />}>
            <MobileMenu />
          </Suspense>
        </div>
      </header>
    </>
  );
}
