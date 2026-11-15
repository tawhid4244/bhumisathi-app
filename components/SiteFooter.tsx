import Link from "next/link";
import { Logo } from "./brand/Logo";
import { T } from "./i18n/LangProvider";
import { SERVICES } from "./site/services";

// Footer on every page: services, help, and the prototype's honesty notice.
export function SiteFooter() {
  return (
    <footer className="mt-auto bg-alpana text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3 lg:col-span-2">
          <Logo tone="light" />
          <p className="max-w-md text-sm text-white/80">
            <T
              bn="জমি কেনার আগে যাচাই, ওয়ারিশের হিসাব, মাপ ও আইনি তথ্য — এক জায়গায়, বাংলায়। একই জমি দুইবার বিক্রি আর নয়।"
              en="Check before you buy, inheritance shares, measurements and the law — in one place, in Bangla. One plot can never be sold twice."
            />
          </p>
          <a
            href="tel:16122"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-4 font-semibold ring-1 ring-white/25 hover:bg-white/20"
          >
            <T bn="ভূমিসেবা হটলাইন ১৬১২২" en="Land service hotline 16122" />
          </a>
        </div>
        <nav aria-label="সেবা / Services">
          <p className="mb-2 font-semibold">
            <T bn="সেবাসমূহ" en="Services" />
          </p>
          <ul className="space-y-1 text-sm text-white/85">
            {SERVICES.slice(0, 6).map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="inline-flex min-h-8 items-center hover:text-white hover:underline"
                >
                  <T bn={s.bn} en={s.en} />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="আরও / More">
          <p className="mb-2 font-semibold">
            <T bn="আরও" en="More" />
          </p>
          <ul className="space-y-1 text-sm text-white/85">
            {[...SERVICES.slice(6), { href: "/judge", bn: "জাজ মোড", en: "Judge mode" }].map(
              (s) => (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    className="inline-flex min-h-8 items-center hover:text-white hover:underline"
                  >
                    <T bn={s.bn} en={s.en} />
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/15">
        <div className="mx-auto max-w-6xl space-y-1 px-4 py-4 text-xs text-white/75">
          <p>
            <T
              bn="সব তথ্য কাল্পনিক (সিনথেটিক)। এটি ঝুঁকি যাচাই, আইনি মালিকানার রায় নয়। এটি সরকারি ওয়েবসাইট নয় — আন্তর্জাতিক এআই বিল্ডার্স কংগ্রেস ২০২৬-এর প্রোটোটাইপ।"
              en="All data is synthetic. This is a risk check on records, not a legal ruling on ownership. Not a government website — a prototype for the International AI Builders Congress 2026."
            />
          </p>
        </div>
      </div>
    </footer>
  );
}
