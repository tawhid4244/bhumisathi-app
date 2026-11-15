"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "../i18n/LangProvider";

// A number that counts up when it scrolls into view, in Bangla or Western digits.
const bnDigits = (s: string) => s.replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);

export function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const { lang } = useLang();
  const [n, setN] = useState(to); // the real number is in the HTML; the animation is a bonus
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / 1100);
        setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      setN(0);
      raf = requestAnimationFrame(step);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);
  const text = `${n}${suffix}`;
  return <span ref={ref}>{lang === "bn" ? bnDigits(text) : text}</span>;
}
