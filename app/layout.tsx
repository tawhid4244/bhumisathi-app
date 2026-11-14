import type { Metadata, Viewport } from "next";
import { Hind_Siliguri, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

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
  themeColor: "#0f2a44",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="bn" className={`${hind.variable} ${plex.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
