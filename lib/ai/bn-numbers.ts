// Bangla number words → digits, for speech transcripts ("একশো পঁয়তাল্লিশ নম্বর দাগ" → "145 নম্বর দাগ").
// Speech engines often write spoken numbers as words. Pure functions, safe in the browser and on
// the server, unit-tested (tests/unit/bn-numbers.test.ts).
//
// Care: some number words are also ordinary words ("নয়" = not, "এক জমি", "বার" = times), so a
// single number word is converted only next to a land word (দাগ, নম্বর, শতক, কানি, খতিয়ান …);
// runs of two or more number words ("একশো পঁয়তাল্লিশ") are always numbers.

const UNITS: string[] = [
  "শূন্য", "এক", "দুই", "তিন", "চার", "পাঁচ", "ছয়", "সাত", "আট", "নয়",
  "দশ", "এগারো", "বারো", "তেরো", "চৌদ্দ", "পনেরো", "ষোলো", "সতেরো", "আঠারো", "উনিশ",
  "বিশ", "একুশ", "বাইশ", "তেইশ", "চব্বিশ", "পঁচিশ", "ছাব্বিশ", "সাতাশ", "আঠাশ", "ঊনত্রিশ",
  "ত্রিশ", "একত্রিশ", "বত্রিশ", "তেত্রিশ", "চৌত্রিশ", "পঁয়ত্রিশ", "ছত্রিশ", "সাঁইত্রিশ", "আটত্রিশ", "ঊনচল্লিশ",
  "চল্লিশ", "একচল্লিশ", "বিয়াল্লিশ", "তেতাল্লিশ", "চুয়াল্লিশ", "পঁয়তাল্লিশ", "ছেচল্লিশ", "সাতচল্লিশ", "আটচল্লিশ", "ঊনপঞ্চাশ",
  "পঞ্চাশ", "একান্ন", "বাহান্ন", "তিপ্পান্ন", "চুয়ান্ন", "পঞ্চান্ন", "ছাপ্পান্ন", "সাতান্ন", "আটান্ন", "ঊনষাট",
  "ষাট", "একষট্টি", "বাষট্টি", "তেষট্টি", "চৌষট্টি", "পঁয়ষট্টি", "ছেষট্টি", "সাতষট্টি", "আটষট্টি", "ঊনসত্তর",
  "সত্তর", "একাত্তর", "বাহাত্তর", "তিয়াত্তর", "চুয়াত্তর", "পঁচাত্তর", "ছিয়াত্তর", "সাতাত্তর", "আটাত্তর", "ঊনআশি",
  "আশি", "একাশি", "বিরাশি", "তিরাশি", "চুরাশি", "পঁচাশি", "ছিয়াশি", "সাতাশি", "আটাশি", "ঊননব্বই",
  "নব্বই", "একানব্বই", "বিরানব্বই", "তিরানব্বই", "চুরানব্বই", "পঁচানব্বই", "ছিয়ানব্বই", "সাতানব্বই", "আটানব্বই", "নিরানব্বই",
]; // prettier-ignore

/** Common spoken/spelling variants → the canonical form above. */
const VARIANTS: Record<string, string> = {
  দু: "দুই", দুয়ে: "দুই", ছ: "ছয়", ছয়: "ছয়", নয়: "নয়", এগার: "এগারো", তের: "তেরো",
  পনের: "পনেরো", ষোল: "ষোলো", সতের: "সতেরো", আঠার: "আঠারো", ঊনিশ: "উনিশ", কুড়ি: "বিশ",
  উনত্রিশ: "ঊনত্রিশ", উনচল্লিশ: "ঊনচল্লিশ", উনপঞ্চাশ: "ঊনপঞ্চাশ", উনষাট: "ঊনষাট", উনসত্তর: "ঊনসত্তর",
  উনআশি: "ঊনআশি", উননব্বই: "ঊননব্বই", চোদ্দ: "চৌদ্দ", পয়তাল্লিশ: "পঁয়তাল্লিশ", পয়ত্রিশ: "পঁয়ত্রিশ",
  পচিশ: "পঁচিশ", পচাত্তর: "পঁচাত্তর", পয়ষট্টি: "পঁয়ষট্টি", পচাশি: "পঁচাশি", পচানব্বই: "পঁচানব্বই",
}; // prettier-ignore

const VALUE = new Map<string, number>(UNITS.map((w, i) => [w.normalize("NFC"), i]));
const VARIANT = new Map<string, string>(
  Object.entries(VARIANTS).map(([k, v]) => [k.normalize("NFC"), v.normalize("NFC")]),
);
const nfcRe = (re: RegExp) => new RegExp(re.source.normalize("NFC"), re.flags);

/** Words that make a lone number word clearly a number. */
const CONTEXT = nfcRe(/^(দাগ|দাগের|নম্বর|নম্বরের|নাম্বার|নং|খতিয়ান|খতিয়ানের|শতক|শতাংশ|ডেসিমাল|কানি|গন্ডা|গণ্ডা|কড়া|ক্রান্তি|কাঠা|বিঘা|একর|বর্গফুট|টাকা|জন|ছেলে|মেয়ে|ভাই|বোন|বছর|দিন)/); // prettier-ignore

const HUNDRED = /^(শো|শ|শত)$/;
const THOUSAND = /^হাজার$/;
const HALF_MORE = nfcRe(/^সাড়ে$/);

/** One canonical Unicode form (NFC), so য়/ড়/ঢ় written either way match the word lists. */
export function normalizeBn(s: string): string {
  return s.normalize("NFC");
}

/** Value of one number word, including "একশো"/"দুইশো" style compounds; null if not a number word. */
function wordValue(word: string): { value: number; kind: "unit" | "hundred" | "thousand" } | null {
  const n = word.normalize("NFC");
  const w = VARIANT.get(n) ?? n;
  if (VALUE.has(w)) return { value: VALUE.get(w)!, kind: "unit" };
  if (HUNDRED.test(w)) return { value: 100, kind: "hundred" };
  if (THOUSAND.test(w)) return { value: 1000, kind: "thousand" };
  // Fused hundreds: একশো, দুশো, তিনশ, পাঁচশত …
  const m = /^(.+?)(শো|শত|শ)$/.exec(w);
  if (m) {
    const head = VARIANT.get(m[1]!) ?? m[1]!;
    if (VALUE.has(head) && VALUE.get(head)! > 0 && VALUE.get(head)! < 10) {
      return { value: VALUE.get(head)! * 100, kind: "unit" };
    }
  }
  return null;
}

/** Fractions spoken as words. */
const FRACTION = new Map<string, number>([
  ["দেড়".normalize("NFC"), 1.5],
  ["আড়াই".normalize("NFC"), 2.5],
]);

/**
 * Replace spoken Bangla numbers with digits. Keeps everything else as it was.
 * "একশো পঁয়তাল্লিশ নম্বর দাগ" → "145 নম্বর দাগ"; "সাড়ে দশ শতক" → "10.5 শতক";
 * "এটা নিরাপদ নয়" stays as it is.
 */
export function wordsToDigits(input: string): string {
  const text = input;
  const key = (w: string) => w.normalize("NFC");
  // Split into words while keeping separators, so we can rebuild the sentence exactly.
  const parts = text.split(/(\s+|[,।?!.;:])/);
  const out: string[] = [];
  let i = 0;
  const isWord = (p: string | undefined) => !!p && !/^(\s+|[,।?!.;:])$/.test(p);
  const nextWord = (from: number) => {
    for (let j = from; j < parts.length; j++) if (isWord(parts[j])) return parts[j]!;
    return "";
  };
  while (i < parts.length) {
    const p = parts[i]!;
    if (!isWord(p)) {
      out.push(p);
      i++;
      continue;
    }
    // Try to read a run of number words starting here.
    let j = i;
    let total = 0;
    let current = 0;
    let half = false;
    let words = 0;
    let fraction: number | null = null;
    while (j < parts.length) {
      const w = parts[j]!;
      if (!isWord(w)) {
        // Allow spaces inside a run ("একশো পঁয়তাল্লিশ"), but not punctuation.
        if (
          /^\s+$/.test(w) &&
          isWord(parts[j + 1]) &&
          (wordValue(parts[j + 1]!) || FRACTION.has(key(parts[j + 1]!)))
        ) {
          // prettier-ignore
          j++;
          continue;
        }
        break;
      }
      if (HALF_MORE.test(key(w)) && words === 0) {
        half = true;
        words++;
        j++;
        continue;
      }
      if (FRACTION.has(key(w)) && words === 0) {
        fraction = FRACTION.get(key(w))!;
        words++;
        j++;
        break;
      }
      const v = wordValue(w);
      if (!v) break;
      // "তিন দশ" is not a number: after 1–99 only শো/হাজার may follow.
      if (v.kind === "unit" && current % 100 !== 0) break;
      if (v.kind === "unit") current += v.value;
      else if (v.kind === "hundred") current = (current || 1) * 100;
      else {
        total += (current || 1) * 1000;
        current = 0;
      }
      words++;
      j++;
    }
    const numberWords = half ? words - 1 : words;
    const hasNumber = fraction !== null || numberWords > 0;
    const after = nextWord(j);
    const confident = fraction !== null || numberWords >= 2 || half || CONTEXT.test(key(after)) || /^\d/.test(after); // prettier-ignore
    if (hasNumber && confident) {
      const value = fraction ?? total + current + (half ? 0.5 : 0);
      out.push(String(value));
      i = j;
    } else {
      out.push(p);
      i++;
    }
  }
  return out.join("");
}

/** Bangla digits → Western digits (১৪৫ → 145). */
export function toWesternDigits(s: string): string {
  return s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
}

/** Everything a transcript needs before parsing: normalized letters, digits for numbers. */
export function normalizeTranscript(s: string): string {
  return toWesternDigits(wordsToDigits(s)).normalize("NFC").replace(/\s+/g, " ").trim();
}
