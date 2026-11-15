"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

// Bangla / English switch for the whole site. The choice is kept in the browser (localStorage +
// a cookie for later server use). The server always renders Bangla first; after loading, the page
// switches to English if the visitor chose it — no reload, no hydration error.

export type Lang = "bn" | "en";
const KEY = "bs_lang";
const EVENT = "bs-lang-change";

function read(): Lang {
  try {
    return localStorage.getItem(KEY) === "en" ? "en" : "bn";
  } catch {
    return "bn"; // private mode or blocked storage: stay in Bangla
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Remember the choice and tell every component on the page. */
function setLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* storage blocked: the switch still works for this page */
  }
  document.cookie = `${KEY}=${l}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new Event(EVENT));
}

/**
 * The visitor's language. Every component reads the store itself (not through a context): while a
 * part of the page is being hydrated — including parts that stream in later, like the account
 * menu — React uses the server value ("bn") for it, so the HTML always matches, and then switches.
 */
export function useLang() {
  const lang = useSyncExternalStore(subscribe, read, () => "bn" as Lang);
  const t = useCallback((bn: string, en: string) => (lang === "en" ? en : bn), [lang]);
  return { lang, setLang, t };
}

/** Keeps <html lang> in step with the choice (screen readers, fonts, spell-checking). */
export function LangProvider({ children }: { children: React.ReactNode }) {
  const { lang } = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return <>{children}</>;
}

/** Text in the visitor's language. Usable from server components too. */
export function T({ bn, en }: { bn: string; en: string }) {
  const { lang } = useLang();
  return <>{lang === "en" ? en : bn}</>;
}

/** বাং | EN pill. */
export function LangToggle({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { lang, setLang } = useLang();
  const base = tone === "dark" ? "border-white/40" : "border-brand";
  const on = tone === "dark" ? "bg-white text-brand-deep" : "bg-brand text-white";
  const off = tone === "dark" ? "text-white" : "text-brand-deep";
  const other: Lang = lang === "bn" ? "en" : "bn";
  return (
    <>
      {/* Phones: one round button that switches to the other language. */}
      <button
        type="button"
        onClick={() => setLang(other)}
        lang={other}
        aria-label={other === "en" ? "Switch to English" : "বাংলায় দেখুন"}
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold sm:hidden ${base} ${off}`}
      >
        {other === "en" ? "EN" : "বাং"}
      </button>
      <div
        role="group"
        aria-label="ভাষা / Language"
        className={`hidden shrink-0 overflow-hidden rounded-full border sm:inline-flex ${base} text-sm font-semibold`}
      >
        {(["bn", "en"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-pressed={lang === l}
            lang={l}
            className={`min-h-9 min-w-11 px-3 transition-colors ${lang === l ? on : off}`}
          >
            {l === "bn" ? "বাং" : "EN"}
          </button>
        ))}
      </div>
    </>
  );
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export const toBnDigits = (s: string | number) =>
  String(s).replace(/\d/g, (d) => BN_DIGITS[Number(d)]!);

/** Numbers (and dates) in the visitor's digits: ১৪৫ in Bangla, 145 in English. */
export function useNum() {
  const { lang } = useLang();
  return useCallback((v: string | number) => (lang === "bn" ? toBnDigits(v) : String(v)), [lang]);
}

/** Digits for server components. */
export function N({ v }: { v: string | number }) {
  return <>{useNum()(v)}</>;
}

/**
 * Bangla with a small English line under/after it (Bangla mode), or just the English (English
 * mode). For headings and labels that were written as "বাংলা <small>English</small>".
 */
export function Bi({
  bn,
  en,
  sub = "text-sm font-normal text-ink-soft",
  block = false,
}: {
  bn: string;
  en: string;
  sub?: string;
  block?: boolean;
}) {
  const { lang } = useLang();
  if (lang === "en") return <>{en}</>;
  return (
    <>
      {bn}
      {block ? null : " "}
      <span lang="en" className={`${sub}${block ? " block" : ""}`}>
        {en}
      </span>
    </>
  );
}
