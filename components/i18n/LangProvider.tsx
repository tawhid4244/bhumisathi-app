"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";

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

interface LangValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Pick the text for the current language. */
  t: (bn: string, en: string) => string;
}

const LangContext = createContext<LangValue>({ lang: "bn", setLang: () => {}, t: (bn) => bn });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribe, read, () => "bn" as Lang);
  const setLang = useCallback((l: Lang) => {
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* storage blocked: the switch still works for this page */
    }
    document.cookie = `${KEY}=${l}; path=/; max-age=31536000; samesite=lax`;
    window.dispatchEvent(new Event(EVENT));
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const t = useCallback((bn: string, en: string) => (lang === "en" ? en : bn), [lang]);
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

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
