import type { Metadata, Viewport } from "next";
import { Hind_Siliguri, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/SiteFooter";
import { LangProvider } from "@/components/i18n/LangProvider";
import { HelpFab } from "@/components/site/HelpFab";
import { SiteHeader } from "@/components/site/SiteHeader";

// Fonts are self-hosted by next/font at build time: no request goes to Google from the browser.
const hind = Hind_Siliguri({
  weight: ["400", "500", "600", "700"],
  subsets: ["bengali", "latin"],
  variable: "--font-hind",
  display: "swap",
});

const plex = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "ভূমিসাথী — এক জমি, এক সত্য", template: "%s · ভূমিসাথী" },
  description:
    "ভূমিসাথী: বাংলায় জমি যাচাই, ওয়ারিশ হিসাব ও আইনি তথ্য। BhumiSathi: one plot, one truth. Prototype with synthetic data.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#00513a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="bn"
      data-scroll-behavior="smooth"
      className={`${hind.variable} ${plex.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <LangProvider>
          <a
            href="#main"
            className="sr-only z-50 rounded-lg bg-card px-4 py-2 focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
          >
            মূল অংশে যান · Skip to content
          </a>
          <SiteHeader />
          <div id="main" className="flex flex-1 flex-col">
            {children}
          </div>
          <SiteFooter />
          <HelpFab />
        </LangProvider>
      </body>
    </html>
  );
}
