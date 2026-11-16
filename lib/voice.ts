// Voice helpers for /chat: Bangla speech in (Web Speech API, bn-BD) and speech out
// (speechSynthesis). The pure functions here are unit-tested; the browser parts are thin.

import { normalizeTranscript } from "./ai/bn-numbers";
import { findDagNumber } from "./ai/intent";

export type VoiceLang = "bn" | "en";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export const toBnDigits = (s: string) => s.replace(/\d/g, (d) => BN_DIGITS[Number(d)]!);
const toWestern = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));

/** Numbers heard in a transcript, in order (Bangla or English digits; decimals kept). */
export function extractNumbers(text: string): number[] {
  return (toWestern(text).match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
}

/**
 * The question Sathi asks before acting on spoken numbers, e.g.
 * "আপনি কি ১৪৫ নম্বর দাগ বলেছেন? ঠিক আছে?" — or null when there are no numbers to confirm.
 */
export function readBackQuestion(raw: string, lang: VoiceLang): string | null {
  const text = normalizeTranscript(raw);
  const nums = extractNumbers(text);
  if (nums.length === 0) return null;
  const western = toWestern(text);
  // "145 নম্বর দাগ", "দাগ 145", "dag 145": treat the number next to the word dag as the dag number.
  const dagMatch =
    /(\d+)\s*(?:নং|নম্বর|নাম্বার)?\s*দাগ/.exec(western) ?? /দাগ\s*(?:নং|নম্বর)?\s*(\d+)/.exec(western) ?? /\b(?:dag|plot)\s*(?:no\.?|number)?\s*(\d+)/i.exec(western); // prettier-ignore
  if (lang === "en") {
    if (dagMatch && nums.length === 1) return `Did you say dag ${dagMatch[1]}? Is that right?`;
    return `Did you say these numbers: ${nums.join(", ")}? Is that right?`;
  }
  if (dagMatch && nums.length === 1)
    return `আপনি কি ${toBnDigits(dagMatch[1]!)} নম্বর দাগ বলেছেন? ঠিক আছে?`;
  return `আপনি কি এই সংখ্যাগুলো বলেছেন: ${nums.map((n) => toBnDigits(String(n))).join(", ")}? ঠিক আছে?`;
}

export interface Alternative {
  transcript: string;
  confidence?: number;
}

/**
 * Pick the best of the speech engine's guesses (we ask for 5) and clean it up: spoken number
 * words become digits ("একশো পঁয়তাল্লিশ" → ১৪৫), so the read-back and the fast answers work.
 * A guess that contains a dag number wins over one that does not — Bangla engines often put
 * "একশো পয়তাল্লিশ নম্বর দাগ" second behind a mis-heard "একশো পয়তাল্লিশ নম্বর ডাক".
 */
export function bestTranscript(alternatives: Alternative[], lang: VoiceLang): string {
  const cleaned = alternatives
    .map((a) => ({ text: normalizeTranscript(a.transcript ?? ""), confidence: a.confidence ?? 0 }))
    .filter((a) => a.text.length > 0);
  if (cleaned.length === 0) return "";
  const withDag = cleaned.find((a) => findDagNumber(a.text) != null);
  const pick = withDag && !findDagNumber(cleaned[0]!.text) && /\d/.test(cleaned[0]!.text) ? withDag : cleaned[0]!; // prettier-ignore
  return lang === "bn" ? toBnDigits(pick.text) : pick.text;
}

/** Text that reads well aloud: no markdown symbols, no links, and not too long. */
export function speakable(text: string, max = 600): string {
  const clean = text
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const stop = Math.max(cut.lastIndexOf("।"), cut.lastIndexOf("."), cut.lastIndexOf("\n"));
  return (stop > max / 2 ? cut.slice(0, stop + 1) : cut).trim();
}

// ---------- browser side ----------

/** Minimal shape of the Web Speech recognition object we use. */
export interface Recognizer {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string; confidence?: number }> & { isFinal?: boolean }> }) => void) | null; // prettier-ignore
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognizerCtor = new () => Recognizer;

/** The browser's speech-recognition class (Chrome/Edge: webkitSpeechRecognition), or null. */
export function recognizerCtor(): RecognizerCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor }; // prettier-ignore
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Speak text with a Bangla voice if the device has one (otherwise the default voice). */
export function speak(text: string, lang: VoiceLang): void {
  if (!canSpeak() || !text) return;
  const synth = window.speechSynthesis;
  synth.cancel(); // never talk over the previous answer
  const u = new SpeechSynthesisUtterance(speakable(text));
  const code = lang === "bn" ? "bn-BD" : "en-US";
  u.lang = code;
  const voices = synth.getVoices();
  const match =
    voices.find((v) => v.lang === code) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(lang));
  if (match) u.voice = match;
  synth.speak(u);
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}
