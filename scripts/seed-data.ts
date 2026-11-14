// The synthetic world from docs/GOLDEN_SCENARIOS.md, built as plain rows.
// Pure and deterministic: no clock, no Math.random. Same input → same rows, every time.
// All people, numbers and records are fictional. NIDs look like SYN-0000-0001.
import { nayaparaMap as map } from "../lib/map-data";
import { polygonAreaDecimals, round } from "../lib/engines/area";

// ---------- deterministic random numbers (mulberry32, seed 2026) ----------
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- ids ----------
export const MOUZA = { NAYAPARA: 1, CHARPARA: 2 } as const;
/** Dag id = 1000 × mouza + dag number, e.g. Nayapara 145 → 1145, Charpara 210 → 2210. */
export const dagId = (mouza: number, dagNo: number) => mouza * 1000 + dagNo;

export const OWNER = {
  RAHIM: 1,
  KARIM_HOSSAIN: 2,
  SALMA: 3, // Buyer A
  JAMAL: 4, // Buyer B
  ABDUL_KARIM: 5, // deceased (G2)
  ROKEYA: 6,
  SOHEL: 7,
  RUBEL: 8,
  NASRIN: 9,
  DEMO_BANK: 10,
  GOVT: 11,
} as const;

const SURVEY_YEAR = { CS: 1915, SA: 1962, RS: 1985, BS: 2015 } as const;
type Survey = keyof typeof SURVEY_YEAR;
const SURVEYS: Survey[] = ["CS", "SA", "RS", "BS"];

// ---------- row types ----------
export interface World {
  mouzas: Record<string, unknown>[];
  owners: Record<string, unknown>[];
  dags: Record<string, unknown>[];
  khatians: Record<string, unknown>[];
  khatian_dags: Record<string, unknown>[];
  ownership_shares: Record<string, unknown>[];
  deeds: Record<string, unknown>[];
  bainas: Record<string, unknown>[];
  liens: Record<string, unknown>[];
  court_cases: Record<string, unknown>[];
  khas_flags: Record<string, unknown>[];
  land_tax: Record<string, unknown>[];
  map_polygons: Record<string, unknown>[];
}

/** Insert order respects foreign keys; the seed truncates in reverse. */
export const TABLE_ORDER: (keyof World)[] = [
  "mouzas",
  "owners",
  "dags",
  "khatians",
  "khatian_dags",
  "ownership_shares",
  "deeds",
  "bainas",
  "liens",
  "court_cases",
  "khas_flags",
  "land_tax",
  "map_polygons",
];

// ---------- people ----------
type P = [id: number, bn: string, en: string, guardianBn: string | null, deceased?: string];

const MAIN_PEOPLE: P[] = [
  [OWNER.RAHIM, "মোঃ রহিম উদ্দিন", "Md. Rahim Uddin", "মোঃ কাশেম উদ্দিন"],
  [OWNER.KARIM_HOSSAIN, "করিম হোসেন", "Karim Hossain", "আব্দুল হাই"],
  [OWNER.SALMA, "সালমা আক্তার", "Salma Akter", "আব্দুর রশিদ"],
  [OWNER.JAMAL, "জামাল মিয়া", "Jamal Mia", "মোঃ ফজলু মিয়া"],
  [OWNER.ABDUL_KARIM, "আব্দুল করিম", "Abdul Karim", "মোঃ ইয়াকুব আলী", "2025-03-12"],
  [OWNER.ROKEYA, "রোকেয়া বেগম", "Rokeya Begum", "স্বামী আব্দুল করিম"],
  [OWNER.SOHEL, "সোহেল", "Sohel", "আব্দুল করিম"],
  [OWNER.RUBEL, "রুবেল", "Rubel", "আব্দুল করিম"],
  [OWNER.NASRIN, "নাসরিন", "Nasrin", "আব্দুল করিম"],
];

// Named owners in the Nayapara story (ids 12–30).
const H = {
  MANNAN: 12,
  JABBAR: 13,
  KASHEM: 14,
  IDRIS: 15,
  SIRAJUL: 16,
  LUTFOR: 17,
  SAMAD: 18,
  YAKUB: 19,
  ANWAR: 20,
  ABUL: 21,
  FATEMA: 22,
  SELINA: 23,
  NURUL: 24,
  HABIBUR: 25,
  MOFIZUL: 26,
} as const;

const STORY_PEOPLE: P[] = [
  [H.MANNAN, "হাজী আব্দুল মান্নান", "Haji Abdul Mannan", "মৃত করিম বক্স", "1948-01-01"],
  [H.JABBAR, "আব্দুল জব্বার", "Abdul Jabbar", "মৃত নবাব আলী", "1955-01-01"],
  [H.KASHEM, "মোঃ কাশেম উদ্দিন", "Md. Kashem Uddin", "আব্দুল জব্বার", "1999-06-01"],
  [H.IDRIS, "মোঃ ইদ্রিস আলী", "Md. Idris Ali", "মৃত সোনা মিয়া", "1990-01-01"],
  [H.SIRAJUL, "মোঃ সিরাজুল ইসলাম", "Md. Sirajul Islam", "মৃত হাশেম আলী", "2011-01-01"],
  [H.LUTFOR, "মোঃ লুৎফর রহমান", "Md. Lutfor Rahman", "মৃত আজিজুর রহমান", "2001-01-01"],
  [H.SAMAD, "আব্দুস সামাদ", "Abdus Samad", "মৃত রমজান আলী", "1996-01-01"],
  [H.YAKUB, "মোঃ ইয়াকুব আলী", "Md. Yakub Ali", "মৃত আমজাদ আলী", "1988-01-01"],
  [H.ANWAR, "আনোয়ার হোসেন", "Anwar Hossain", "মোঃ ইদ্রিস আলী"],
  [H.ABUL, "আবুল হোসেন", "Abul Hossain", "মোঃ সিরাজুল ইসলাম"],
  [H.FATEMA, "ফাতেমা খাতুন", "Fatema Khatun", "স্বামী মোঃ জসিম উদ্দিন"],
  [H.SELINA, "সেলিনা পারভীন", "Selina Parvin", "স্বামী মোঃ মাসুদ রানা"],
  [H.NURUL, "নুরুল ইসলাম", "Nurul Islam", "মোঃ লুৎফর রহমান"],
  [H.HABIBUR, "হাবিবুর রহমান", "Habibur Rahman", "আব্দুস সামাদ"],
  [H.MOFIZUL, "মফিজুল হক", "Mofizul Haque", "মৃত আব্দুল গফুর"],
];

// Filler owners for the other dags (ids 31+).
const FILLER_NAMES: [string, string, string][] = [
  ["শহিদুল ইসলাম", "Shahidul Islam", "মৃত আব্দুল আজিজ"],
  ["রাশিদা বেগম", "Rashida Begum", "স্বামী মোঃ আলমগীর"],
  ["মিজানুর রহমান", "Mizanur Rahman", "মৃত হাফিজ উদ্দিন"],
  ["শিরিন আক্তার", "Shirin Akter", "মোঃ সাইফুল ইসলাম"],
  ["কামাল উদ্দিন", "Kamal Uddin", "মৃত জামাল উদ্দিন"],
  ["পারভীন সুলতানা", "Parveen Sultana", "স্বামী মোঃ শাহজাহান"],
  ["দেলোয়ার হোসেন", "Delwar Hossain", "মৃত মোবারক হোসেন"],
  ["হালিমা খাতুন", "Halima Khatun", "স্বামী মোঃ কুদ্দুস"],
  ["মনির হোসেন", "Monir Hossain", "আব্দুল মালেক"],
  ["রিনা দাস", "Rina Das", "স্বামী গোপাল চন্দ্র দাস"],
  ["গোপাল চন্দ্র দাস", "Gopal Chandra Das", "মৃত হরিপদ দাস"],
  ["জয়নাল আবেদীন", "Joynal Abedin", "মৃত আব্দুল খালেক"],
  ["মরিয়ম বেগম", "Moriom Begum", "স্বামী মোঃ ইউনুস"],
  ["শফিকুল আলম", "Shafiqul Alam", "মৃত নুরুল আলম"],
  ["রুমা আক্তার", "Ruma Akter", "মোঃ বাবুল মিয়া"],
  ["বাবুল মিয়া", "Babul Mia", "মৃত সোহরাব মিয়া"],
];
const FILLER_START = 31;

function personRows(): Record<string, unknown>[] {
  const all: P[] = [
    ...MAIN_PEOPLE,
    ...STORY_PEOPLE,
    ...FILLER_NAMES.map(([bn, en, g], i) => [FILLER_START + i, bn, en, g] as P),
  ];
  const rows = all.map(([id, bn, en, guardian, died]) => ({
    id,
    kind: "person",
    name_bn: bn,
    name_en: en,
    guardian_name_bn: guardian,
    // Only living people have a (synthetic) NID and phone.
    nid: died ? null : `SYN-0000-${String(id).padStart(4, "0")}`,
    phone: died ? null : `+880-SYN-${String(id).padStart(4, "0")}`,
    is_deceased: Boolean(died),
    died_on: died ?? null,
    is_synthetic: true,
  }));
  rows.push(
    {
      id: OWNER.DEMO_BANK,
      kind: "bank",
      name_bn: "ডেমো ব্যাংক লিমিটেড",
      name_en: "Demo Bank Ltd.",
      guardian_name_bn: null,
      nid: null,
      phone: null,
      is_deceased: false,
      died_on: null,
      is_synthetic: true,
    },
    {
      id: OWNER.GOVT,
      kind: "government",
      name_bn: "বাংলাদেশ সরকার, পক্ষে জেলা প্রশাসক (খাস)",
      name_en: "Government of Bangladesh, through the Deputy Commissioner (khas)",
      guardian_name_bn: null,
      nid: null,
      phone: null,
      is_deceased: false,
      died_on: null,
      is_synthetic: true,
    },
  );
  return rows.sort((a, b) => (a.id as number) - (b.id as number));
}

// ---------- dags and their CS → SA → RS → BS chains ----------
interface ChainStep {
  khatianNo: number;
  owners: { id: number; share?: number }[]; // share defaults to the full area split evenly
  area?: number; // area in that survey; defaults to the BS area
}
interface DagSpec {
  mouza: number;
  dagNo: number;
  area: number; // BS recorded area, decimals
  classBn: string;
  classEn: string;
  chain: Record<Survey, ChainStep>;
}

const NAL = ["নাল (কৃষি)", "Nal (agricultural)"] as const;
const VITI = ["ভিটি (বসতবাড়ি)", "Viti (homestead)"] as const;
const DOBA = ["জলাশয়", "Waterbody"] as const;

/** Old surveys numbered dags differently; this is how each mouza's numbers moved. */
function surveyDagNo(mouza: number, dagNo: number, survey: Survey): number {
  const shift =
    mouza === MOUZA.NAYAPARA ? { CS: 79, SA: 45, RS: 0, BS: 0 } : { CS: 120, SA: 60, RS: 0, BS: 0 };
  return dagNo - shift[survey];
}

/** BS area = map area rounded to 0.1 decimal + the khatian offset in nayapara.json. */
function mapArea(dagNo: number): number {
  const pts = map.dags[String(dagNo)]!;
  const offset = map.khatian_offset_decimals[String(dagNo)] ?? 0;
  return round(round(polygonAreaDecimals(pts, map.units_per_inch, 16), 1) + offset, 2);
}

function storyDags(): DagSpec[] {
  const N = MOUZA.NAYAPARA;
  const one = (khatianNo: number, id: number, area?: number): ChainStep => ({
    khatianNo,
    owners: [{ id }],
    area,
  });
  return [
    // 141: clean record, used for the BhumiSeal report (G7) → GREEN
    {
      mouza: N,
      dagNo: 141,
      area: mapArea(141),
      classBn: VITI[0],
      classEn: VITI[1],
      chain: {
        CS: one(12, H.MANNAN),
        SA: one(40, H.IDRIS),
        RS: one(101, H.ANWAR),
        BS: one(205, H.ANWAR),
      },
    },
    // 142: open civil suit 101/2025 (G5) → RED
    {
      mouza: N,
      dagNo: 142,
      area: mapArea(142),
      classBn: NAL[0],
      classEn: NAL[1],
      chain: {
        CS: one(12, H.MANNAN),
        SA: one(41, H.SIRAJUL),
        RS: one(102, H.ABUL),
        BS: one(206, H.ABUL),
      },
    },
    // 143: Rahim; deed 4512/2024 sold 8 dec to Karim; khatian is 3 dec more than the map (G3)
    {
      mouza: N,
      dagNo: 143,
      area: mapArea(143),
      classBn: NAL[0],
      classEn: NAL[1],
      chain: {
        CS: one(15, H.JABBAR),
        SA: one(44, H.KASHEM),
        RS: one(110, OWNER.RAHIM),
        BS: one(210, OWNER.RAHIM),
      },
    },
    // 144: clean; an old baina that already expired
    {
      mouza: N,
      dagNo: 144,
      area: mapArea(144),
      classBn: NAL[0],
      classEn: NAL[1],
      chain: {
        CS: one(12, H.MANNAN),
        SA: one(41, H.SIRAJUL),
        RS: one(103, H.FATEMA),
        BS: one(207, H.FATEMA),
      },
    },
    // 145: Rahim holds 20 decimals, tax paid, no locks (G1 double sale, G8 voice)
    {
      mouza: N,
      dagNo: 145,
      area: mapArea(145),
      classBn: NAL[0],
      classEn: NAL[1],
      chain: {
        CS: one(15, H.JABBAR),
        SA: one(44, H.KASHEM),
        RS: one(110, OWNER.RAHIM),
        BS: { khatianNo: 210, owners: [{ id: OWNER.RAHIM, share: 20 }] },
      },
    },
    // 146: Demo Bank mortgage on 5 dec (G5)
    {
      mouza: N,
      dagNo: 146,
      area: mapArea(146),
      classBn: VITI[0],
      classEn: VITI[1],
      chain: {
        CS: one(12, H.MANNAN),
        SA: one(42, H.LUTFOR),
        RS: one(104, H.SELINA),
        BS: one(208, H.SELINA),
      },
    },
    // 147: land tax unpaid for years
    {
      mouza: N,
      dagNo: 147,
      area: mapArea(147),
      classBn: NAL[0],
      classEn: NAL[1],
      chain: {
        CS: one(12, H.MANNAN),
        SA: one(42, H.LUTFOR),
        RS: one(105, H.NURUL),
        BS: one(209, H.NURUL),
      },
    },
    // 148: RS area disagrees with BS by 2 dec (chain mismatch)
    {
      mouza: N,
      dagNo: 148,
      area: mapArea(148),
      classBn: NAL[0],
      classEn: NAL[1],
      chain: {
        CS: one(12, H.MANNAN),
        SA: one(43, H.SAMAD),
        RS: one(106, H.HABIBUR, round(mapArea(148) + 2, 2)),
        BS: one(211, H.HABIBUR),
      },
    },
    // 149: khas waterbody, recorded in khas khatian no. 1 in every survey (G4)
    {
      mouza: N,
      dagNo: 149,
      area: mapArea(149),
      classBn: DOBA[0],
      classEn: DOBA[1],
      chain: {
        CS: one(1, OWNER.GOVT),
        SA: one(1, OWNER.GOVT),
        RS: one(1, OWNER.GOVT),
        BS: one(1, OWNER.GOVT),
      },
    },
    // Charpara 210 and 211: Abdul Karim (deceased), heirs Rokeya, Sohel, Rubel, Nasrin (G2)
    ...[210, 211].map((dagNo): DagSpec => ({
      mouza: MOUZA.CHARPARA,
      dagNo,
      area: dagNo === 210 ? 60 : 40,
      classBn: NAL[0],
      classEn: NAL[1],
      chain: {
        CS: one(7, H.YAKUB),
        SA: one(21, H.YAKUB),
        RS: one(88, OWNER.ABDUL_KARIM),
        BS: one(150, OWNER.ABDUL_KARIM),
      },
    })),
  ];
}

/** Ordinary dags that fill out the two mouzas (Nayapara 150–179, Charpara 212–230). */
function fillerDags(rand: () => number): DagSpec[] {
  const specs: DagSpec[] = [];
  const fillerOwner = () => FILLER_START + Math.floor(rand() * FILLER_NAMES.length);
  const ranges: [number, number, number][] = [
    [MOUZA.NAYAPARA, 150, 179],
    [MOUZA.CHARPARA, 212, 230],
  ];
  for (const [mouza, from, to] of ranges) {
    for (let dagNo = from; dagNo <= to; dagNo++) {
      const area = round(5 + rand() * 40, 1);
      const a = fillerOwner();
      let b = fillerOwner();
      if (b === a) b = FILLER_START + ((b - FILLER_START + 1) % FILLER_NAMES.length);
      const coOwned = rand() < 0.3;
      const bsOwners = coOwned
        ? [
            { id: a, share: round(area / 2, 2) },
            { id: b, share: round(area - round(area / 2, 2), 2) },
          ]
        : [{ id: a, share: area }];
      const homestead = rand() < 0.25;
      const csHolder = rand() < 0.5 ? H.MANNAN : H.JABBAR;
      const baseKh = mouza === MOUZA.NAYAPARA ? 300 : 200;
      specs.push({
        mouza,
        dagNo,
        area,
        classBn: homestead ? VITI[0] : NAL[0],
        classEn: homestead ? VITI[1] : NAL[1],
        chain: {
          CS: { khatianNo: mouza === MOUZA.NAYAPARA ? 13 : 8, owners: [{ id: csHolder }] },
          SA: { khatianNo: 60 + (dagNo % 7), owners: [{ id: rand() < 0.5 ? H.LUTFOR : H.SAMAD }] },
          RS: { khatianNo: 120 + (dagNo - from), owners: [{ id: a }] },
          BS: { khatianNo: baseKh + (dagNo - from), owners: bsOwners },
        },
      });
    }
  }
  return specs;
}

// ---------- assemble ----------
export function buildWorld(seed = 2026): World {
  const rand = rng(seed);
  const specs = [...storyDags(), ...fillerDags(rand)].sort(
    (x, y) => dagId(x.mouza, x.dagNo) - dagId(y.mouza, y.dagNo),
  );

  const mouzas = [
    {
      id: MOUZA.NAYAPARA,
      code: "NAY",
      name_bn: "নয়াপাড়া",
      name_en: "Nayapara",
      jl_no: 45,
      district_bn: "ঢাকা (কাল্পনিক)",
      district_en: "Dhaka (synthetic)",
      upazila_bn: "ডেমো উপজেলা",
      upazila_en: "Demo Upazila",
      map_sheet: 1,
      map_scale_in_per_mile: 16,
      has_map: true,
      is_synthetic: true,
    },
    {
      id: MOUZA.CHARPARA,
      code: "CHR",
      name_bn: "চরপাড়া",
      name_en: "Charpara",
      jl_no: 46,
      district_bn: "ঢাকা (কাল্পনিক)",
      district_en: "Dhaka (synthetic)",
      upazila_bn: "ডেমো উপজেলা",
      upazila_en: "Demo Upazila",
      map_sheet: null,
      map_scale_in_per_mile: null,
      has_map: false,
      is_synthetic: true,
    },
  ];

  const dags = specs.map((s) => ({
    id: dagId(s.mouza, s.dagNo),
    mouza_id: s.mouza,
    dag_no: s.dagNo,
    land_class_bn: s.classBn,
    land_class_en: s.classEn,
    recorded_area_dec: s.area,
    is_synthetic: true,
  }));

  // Khatians: one row per (mouza, survey, khatian number), ids in a fixed order.
  const khatianKey = (m: number, sv: Survey, no: number) => `${m}|${sv}|${no}`;
  const khatianIds = new Map<string, number>();
  const khatians: Record<string, unknown>[] = [];
  for (const s of specs) {
    for (const sv of SURVEYS) {
      const key = khatianKey(s.mouza, sv, s.chain[sv].khatianNo);
      if (!khatianIds.has(key)) khatianIds.set(key, -1);
    }
  }
  const sortedKeys = [...khatianIds.keys()].sort((a, b) => {
    const [ma, sa, na] = a.split("|");
    const [mb, sb, nb] = b.split("|");
    return (
      Number(ma) - Number(mb) ||
      SURVEYS.indexOf(sa as Survey) - SURVEYS.indexOf(sb as Survey) ||
      Number(na) - Number(nb)
    );
  });
  sortedKeys.forEach((key, i) => {
    const [m, sv, no] = key.split("|");
    khatianIds.set(key, i + 1);
    khatians.push({
      id: i + 1,
      mouza_id: Number(m),
      survey: sv,
      khatian_no: Number(no),
      prepared_year: SURVEY_YEAR[sv as Survey],
      is_synthetic: true,
    });
  });

  const khatian_dags: Record<string, unknown>[] = [];
  const ownership_shares: Record<string, unknown>[] = [];
  let shareId = 1;
  for (const s of specs) {
    for (const sv of SURVEYS) {
      const step = s.chain[sv];
      const khatianId = khatianIds.get(khatianKey(s.mouza, sv, step.khatianNo))!;
      const area = step.area ?? s.area;
      khatian_dags.push({
        khatian_id: khatianId,
        dag_id: dagId(s.mouza, s.dagNo),
        survey_dag_no: surveyDagNo(s.mouza, s.dagNo, sv),
        area_dec: area,
        is_synthetic: true,
      });
      for (const o of step.owners) {
        ownership_shares.push({
          id: shareId++,
          khatian_id: khatianId,
          dag_id: dagId(s.mouza, s.dagNo),
          owner_id: o.id,
          share_dec: o.share ?? round(area / step.owners.length, 2),
          is_synthetic: true,
        });
      }
    }
  }

  const bsKhatian = (mouza: number, no: number) => khatianIds.get(khatianKey(mouza, "BS", no))!;
  const N = MOUZA.NAYAPARA;
  const office = "ডেমো সাব-রেজিস্ট্রি অফিস (কাল্পনিক)";

  const deeds = [
    {
      id: 1,
      deed_no: "1207/2009",
      deed_type: "sale",
      registered_on: "2009-03-02",
      sub_registry_bn: office,
      seller_owner_id: H.SIRAJUL,
      buyer_owner_id: H.FATEMA,
      dag_id: dagId(N, 144),
      khatian_id: khatianIds.get(khatianKey(N, "RS", 103)) ?? null,
      area_dec: mapArea(144),
      price_tk: 450000,
      after_latest_khatian: false,
      is_synthetic: true,
    },
    // G3: deed 4512/2024, Rahim → Karim Hossain, dag 143, BS khatian 210, 8 decimals.
    {
      id: 2,
      deed_no: "4512/2024",
      deed_type: "sale",
      registered_on: "2024-05-14",
      sub_registry_bn: office,
      seller_owner_id: OWNER.RAHIM,
      buyer_owner_id: OWNER.KARIM_HOSSAIN,
      dag_id: dagId(N, 143),
      khatian_id: bsKhatian(N, 210),
      area_dec: 8,
      price_tk: 1600000,
      after_latest_khatian: true,
      is_synthetic: true,
    },
  ];

  const bainas = [
    {
      id: "B-0007",
      dag_id: dagId(N, 144),
      seller_owner_id: H.FATEMA,
      buyer_owner_id: OWNER.JAMAL,
      area_dec: 5,
      amount_tk: 100000,
      registered_on: "2025-01-10",
      expires_on: "2025-04-10",
      status: "expired",
      is_synthetic: true,
    },
  ];

  const liens = [
    {
      id: "L-0003",
      dag_id: dagId(N, 146),
      owner_id: H.SELINA,
      lender_owner_id: OWNER.DEMO_BANK,
      area_dec: 5,
      loan_ref: "DBL/HL/2025/0042",
      registered_on: "2025-02-03",
      status: "active",
      is_synthetic: true,
    },
  ];

  const court_cases = [
    {
      id: 1,
      case_no: "101/2025",
      court_bn: "যুগ্ম জেলা জজ আদালত, ডেমো (কাল্পনিক)",
      court_en: "Joint District Judge Court, Demo (synthetic)",
      case_type: "civil",
      dag_id: dagId(N, 142),
      plaintiff_bn: "মফিজুল হক",
      defendant_bn: "আবুল হোসেন",
      filed_on: "2025-08-20",
      status: "pending",
      summary_bn: "স্বত্ব ঘোষণা ও চিরস্থায়ী নিষেধাজ্ঞার দেওয়ানি মামলা (চলমান)",
      summary_en: "Civil suit for declaration of title and permanent injunction (pending)",
      is_synthetic: true,
    },
    {
      id: 2,
      case_no: "77/2019",
      court_bn: "সহকারী জজ আদালত, ডেমো (কাল্পনিক)",
      court_en: "Assistant Judge Court, Demo (synthetic)",
      case_type: "civil",
      dag_id: dagId(N, 152),
      plaintiff_bn: "কামাল উদ্দিন",
      defendant_bn: "মনির হোসেন",
      filed_on: "2019-04-11",
      status: "disposed",
      summary_bn: "সীমানা নিয়ে মামলা, ২০২১ সালে নিষ্পত্তি",
      summary_en: "Boundary suit, disposed in 2021",
      is_synthetic: true,
    },
  ];

  const khas_flags = [
    {
      dag_id: dagId(N, 149),
      category_bn: "খাস জলাশয় (জলমহাল)",
      category_en: "Khas waterbody (jalmahal)",
      source: "Synthetic khas register, Demo Upazila (1 নং খাস খতিয়ান)",
      is_synthetic: true,
    },
  ];

  // Land development tax: paid for everyone on the BS khatian, with two exceptions.
  const land_tax: Record<string, unknown>[] = [];
  for (const s of specs) {
    const id = dagId(s.mouza, s.dagNo);
    if (s.chain.BS.owners.some((o) => o.id === OWNER.GOVT)) continue; // khas: no tax
    for (const o of s.chain.BS.owners) {
      let fy = "2026-27";
      let paid = "2026-07-15";
      if (s.mouza === N && s.dagNo === 147) [fy, paid] = ["2021-22", "2021-09-10"];
      if (o.id === OWNER.ABDUL_KARIM) [fy, paid] = ["2024-25", "2024-08-01"];
      land_tax.push({
        dag_id: id,
        owner_id: o.id,
        paid_through_fy: fy,
        last_paid_on: paid,
        is_synthetic: true,
      });
    }
  }

  const map_polygons = Object.entries(map.dags).map(([no, pts]) => ({
    dag_id: dagId(N, Number(no)),
    map_sheet: map.sheet,
    units_per_inch: map.units_per_inch,
    points: pts,
    is_synthetic: true,
  }));

  return {
    mouzas,
    owners: personRows(),
    dags,
    khatians,
    khatian_dags,
    ownership_shares,
    deeds,
    bainas,
    liens,
    court_cases,
    khas_flags,
    land_tax,
    map_polygons,
  };
}
