// Screen text for the chat page in both languages (Bangla is the default).

export type Lang = "bn" | "en";

export const STR = {
  bn: {
    intro: "জমি নিয়ে যেকোনো প্রশ্ন বাংলায় লিখুন। সাথী রেকর্ড যাচাই করে ও আইনের সূত্র দিয়ে উত্তর দেয়।",
    placeholder: "আপনার প্রশ্ন লিখুন…",
    send: "পাঠান",
    thinking: "সাথী ভাবছে…",
    you: "আপনি",
    sathi: "সাথী",
    sources: "সূত্র",
    confirmTitle: "নিশ্চিত করুন",
    yes: "হ্যাঁ, নিশ্চিত",
    no: "না, বাতিল",
    newChat: "নতুন কথোপকথন",
    openReport: "পূর্ণ রিপোর্ট দেখুন",
    error: "দুঃখিত, সমস্যা হয়েছে। আবার চেষ্টা করুন।",
    tryThese: "এগুলো চেষ্টা করুন",
    disclaimer: "সাথী তথ্য দেয়, আইনি পরামর্শ নয়। সব তথ্য কাল্পনিক (ডেমো)।",
    langLabel: "ভাষা",
    micStart: "কথা বলুন",
    micStop: "থামান",
    listening: "শুনছি… বাংলায় বলুন",
    heardTitle: "আপনি বললেন",
    heardYes: "হ্যাঁ, পাঠান",
    heardNo: "না, ঠিক করি",
    listen: "শুনুন",
    micDenied: "মাইক্রোফোন চালু করতে ব্রাউজারে অনুমতি দিন। টাইপ করেও প্রশ্ন করতে পারেন।",
    micError: "কথা বোঝা যায়নি। আবার চেষ্টা করুন বা টাইপ করুন।",
  },
  en: {
    intro: "Ask anything about land. Sathi checks the records and cites the law.",
    placeholder: "Type your question…",
    send: "Send",
    thinking: "Sathi is thinking…",
    you: "You",
    sathi: "Sathi",
    sources: "Sources",
    confirmTitle: "Please confirm",
    yes: "Yes, confirm",
    no: "No, cancel",
    newChat: "New conversation",
    openReport: "Open full report",
    error: "Sorry, something went wrong. Please try again.",
    tryThese: "Try these",
    disclaimer: "Sathi gives information, not legal advice. All data is fictional (demo).",
    langLabel: "Language",
    micStart: "Speak",
    micStop: "Stop",
    listening: "Listening… speak now",
    heardTitle: "You said",
    heardYes: "Yes, send",
    heardNo: "No, let me fix it",
    listen: "Listen",
    micDenied: "Allow microphone access in your browser, or type your question.",
    micError: "Could not understand. Try again or type.",
  },
} as const;

export const SUGGESTIONS: Record<Lang, string[]> = {
  bn: [
    "১৪৫ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও",
    "নামজারি করতে কী কী লাগবে আর খরচ কত?",
    "বায়না রেজিস্ট্রি কত দিনের মধ্যে করতে হয়?",
  ],
  en: [
    "Is it safe to buy dag 145 in Nayapara?",
    "How much does mutation (namjari) cost?",
    "What happens if someone sells the same land twice?",
  ],
};

/** Badge text for each tool, shown under an answer. */
export const TOOL_LABEL: Record<string, Record<Lang, string>> = {
  find_dag: { bn: "দাগ খোঁজা হয়েছে", en: "Dag found" },
  ledger_status: { bn: "লেজার দেখা হয়েছে", en: "Ledger checked" },
  jomi_check: { bn: "জমি যাচাই করা হয়েছে", en: "Land checked" },
  law_search: { bn: "আইন খোঁজা হয়েছে", en: "Law searched" },
  map_area: { bn: "ম্যাপে মাপা হয়েছে", en: "Measured on map" },
  warish_compute: { bn: "ওয়ারিশ হিসাব হয়েছে", en: "Inheritance calculated" },
  deed_read: { bn: "দলিল পড়া হয়েছে", en: "Deed read" },
  find_person: { bn: "ব্যক্তি খোঁজা হয়েছে", en: "Person found" },
  register_baina: { bn: "বায়না নিবন্ধন", en: "Baina registration" },
  register_sale: { bn: "বিক্রয় নিবন্ধন", en: "Sale registration" },
  register_lien: { bn: "বন্ধক নিবন্ধন", en: "Mortgage registration" },
};

/** "ধারা ১৪৩" for a statute section; nothing for a fee schedule or service note. */
export function sectionLabel(section: string): string {
  if (!/^\d/.test(section)) return "";
  return `ধারা ${section.replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!)}`;
}
