import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";
import { getSql } from "../sql";
import { verifyAuditChain } from "./audit";
import { jomiCheck } from "./jomi-check";
import { resolveDag } from "./ledger";

// BhumiSeal-lite: a land report signed with Ed25519, carried in a QR code, checked on /verify.
//
//   code = "BS1." + base64url(payload JSON) + "." + base64url(Ed25519 signature of those bytes)
//
// /verify shows four lights:
//   1. genuine    — the signature matches BhumiSathi's public key (nobody changed a digit)
//   2. current    — the dag's ledger version is still the one in the report (nothing new since)
//   3. untouched  — the issue is recorded in the hash-chained audit log and the chain is intact
//   4. shares add up — the holders' shares equal the dag's area and nobody holds a negative balance
//
// The private key lives only in .env.local / the host's secret store (SEAL_PRIVATE_KEY).

export const SEAL_PREFIX = "BS1";
const TOLERANCE = 0.01; // decimals

export interface SealPayload {
  v: 1;
  id: string; // random seal id
  kid: string; // which key signed it
  issued_at: string;
  mouza_bn: string;
  mouza_en: string;
  jl_no: number;
  dag_no: number;
  area_dec: number;
  verdict: "red" | "amber" | "green";
  holders: { name_bn: string; name_en?: string; recorded_dec: number; sellable_dec: number }[];
  ledger_version: number;
}

export class SealKeyMissingError extends Error {
  constructor() {
    super("SEAL_PRIVATE_KEY is not set. Run `npm run users` to create one in .env.local.");
    this.name = "SealKeyMissingError";
  }
}

let cached: { priv: KeyObject; pub: KeyObject; kid: string; pem: string; raw: string } | null =
  null;

/** The signing key from the environment (PKCS#8 DER, base64). */
export function sealKeys() {
  const b64 = process.env.SEAL_PRIVATE_KEY;
  if (!b64) throw new SealKeyMissingError();
  if (cached && cached.raw === b64) return cached;
  const priv = createPrivateKey({ key: Buffer.from(b64, "base64"), format: "der", type: "pkcs8" });
  if (priv.asymmetricKeyType !== "ed25519") throw new Error("SEAL_PRIVATE_KEY must be Ed25519.");
  const pub = createPublicKey(priv);
  const der = pub.export({ format: "der", type: "spki" });
  const kid = createHash("sha256").update(der).digest("hex").slice(0, 16);
  const pem = pub.export({ format: "pem", type: "spki" }).toString();
  cached = { priv, pub, kid, pem, raw: b64 };
  return cached;
}

const b64u = (b: Buffer) => b.toString("base64url");
const sha256hex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/** Build and sign a report for a dag. The caller records it in the audit log (seal_issue). */
export async function issueSeal(
  mouza: string,
  dagNo: number,
  now = new Date(),
): Promise<{ code: string; payload: SealPayload; payload_sha256: string }> {
  const { priv, kid } = sealKeys();
  const r = await jomiCheck({ mouza, dag_no: dagNo });
  const payload: SealPayload = {
    v: 1,
    id: randomBytes(8).toString("hex"),
    kid,
    issued_at: now.toISOString(),
    mouza_bn: r.dag.mouza_bn,
    mouza_en: r.dag.mouza_en,
    jl_no: r.dag.jl_no,
    dag_no: r.dag.dag_no,
    area_dec: r.dag.recorded_area_dec,
    verdict: r.verdict,
    holders: r.holders.map((h) => ({
      name_bn: h.name_bn,
      name_en: h.name_en,
      recorded_dec: h.recorded_dec,
      sellable_dec: h.sellable_dec,
    })),
    ledger_version: r.ledger_version,
  };
  const json = JSON.stringify(payload);
  const sig = sign(null, Buffer.from(json, "utf8"), priv);
  return {
    code: `${SEAL_PREFIX}.${b64u(Buffer.from(json, "utf8"))}.${b64u(sig)}`,
    payload,
    payload_sha256: sha256hex(json),
  };
}

export type Light = "green" | "amber" | "red";

export interface SealCheck {
  overall: Light;
  overall_bn: string;
  overall_en: string;
  lights: {
    genuine: { ok: boolean; bn: string; en: string };
    current: { ok: boolean; bn: string; en: string; events_since?: number };
    untouched: { ok: boolean; bn: string; en: string };
    shares_add_up: { ok: boolean; bn: string; en: string };
  };
  payload: SealPayload | null;
  /** The seal id and dag, for the audit log entry of this verification. */
  dag_id: number | null;
}

/** Split and decode a code. Returns null when it is not a BhumiSeal at all. */
export function parseCode(
  code: string,
): { json: string; sig: Buffer; payload: SealPayload } | null {
  const raw = code.trim().replace(/^.*[#?]/, ""); // a full /verify#… URL is fine too
  const parts = raw.split(".");
  if (parts.length !== 3 || parts[0] !== SEAL_PREFIX) return null;
  try {
    const json = Buffer.from(parts[1]!, "base64url").toString("utf8");
    const payload = JSON.parse(json) as SealPayload;
    if (payload?.v !== 1 || typeof payload.dag_no !== "number") return null;
    return { json, sig: Buffer.from(parts[2]!, "base64url"), payload };
  } catch {
    return null;
  }
}

const RED_ALL = (bn: string, en: string): SealCheck["lights"] => ({
  genuine: { ok: false, bn, en },
  current: { ok: false, bn: "যাচাই করা যায়নি", en: "Could not be checked" },
  untouched: { ok: false, bn: "যাচাই করা যায়নি", en: "Could not be checked" },
  shares_add_up: { ok: false, bn: "যাচাই করা যায়নি", en: "Could not be checked" },
});

export async function verifySeal(code: string): Promise<SealCheck> {
  const parsed = parseCode(code);
  if (!parsed) {
    return {
      overall: "red",
      overall_bn: "এটি ভূমিসাথীর সিল নয়",
      overall_en: "NOT A BHUMISEAL",
      lights: RED_ALL("কোডটি পড়া যায়নি", "The code could not be read"),
      payload: null,
      dag_id: null,
    };
  }
  const { json, sig, payload } = parsed;
  const { pub, kid } = sealKeys();

  // 1. Genuine: our key, and the signature covers these exact bytes.
  let genuine = false;
  try {
    genuine = payload.kid === kid && sig.length === 64 && verify(null, Buffer.from(json, "utf8"), pub, sig); // prettier-ignore
  } catch {
    genuine = false;
  }
  const dag = await resolveDag(payload.mouza_en ?? "", payload.dag_no).catch(() => null);

  if (!genuine) {
    return {
      overall: "red",
      overall_bn: "আসল নয় — রিপোর্টটি বদলানো হয়েছে বা নকল",
      overall_en: "NOT GENUINE",
      lights: RED_ALL("স্বাক্ষর মেলেনি: রিপোর্টের কোনো তথ্য বদলানো হয়েছে", "The signature does not match: something in the report was changed"), // prettier-ignore
      payload,
      dag_id: dag?.id ?? null,
    };
  }

  // 2. Current: has anything been recorded on this dag since the report was signed?
  const version = dag?.version ?? -1;
  const eventsSince = dag
    ? Number(
        (
          await getSql()<{ n: number }[]>`
            select count(*)::int as n from ledger_events
            where dag_id = ${dag.id} and status = 'accepted' and dag_version > ${payload.ledger_version}`
        )[0]!.n,
      )
    : 0;
  const current = version === payload.ledger_version;

  // 3. Untouched: the issue is in the audit log with the same payload hash, and the chain holds.
  const [issued] = await getSql()<{ n: number }[]>`
    select count(*)::int as n from audit_log
    where action = 'seal_issue' and detail->>'seal_id' = ${payload.id}
      and detail->>'payload_sha256' = ${sha256hex(json)}`;
  const chain = await verifyAuditChain();
  const untouched = (issued?.n ?? 0) > 0 && chain.ok;

  // 4. Shares add up: today's holders' shares = the dag's area, nobody oversold.
  const sums = dag
    ? (
        await getSql()<{ total: number; oversold: number }[]>`
          select coalesce(sum(recorded_dec), 0)::float8 as total,
                 count(*) filter (where sold_dec + reserved_dec + locked_dec > recorded_dec + ${TOLERANCE})::int as oversold
          from share_balances where dag_id = ${dag.id}`
      )[0]!
    : { total: 0, oversold: 1 };
  const payloadSum = payload.holders.reduce((a, h) => a + h.recorded_dec, 0);
  const sharesOk =
    !!dag &&
    Math.abs(sums.total - dag.recorded_area_dec) <= TOLERANCE &&
    Math.abs(payloadSum - payload.area_dec) <= TOLERANCE &&
    sums.oversold === 0;

  const lights: SealCheck["lights"] = {
    genuine: { ok: true, bn: "ভূমিসাথীর চাবি দিয়ে স্বাক্ষরিত; কোনো তথ্য বদলানো হয়নি", en: "Signed with BhumiSathi's key; nothing was changed" }, // prettier-ignore
    current: current
      ? { ok: true, bn: "রিপোর্টের পরে এই দাগে নতুন কিছু নিবন্ধিত হয়নি", en: "Nothing new has been registered on this dag since the report", events_since: 0 } // prettier-ignore
      : {
          ok: false,
          bn: `রিপোর্টের পরে এই দাগে ${bnDigits(eventsSince)}টি নতুন লেনদেন হয়েছে — নতুন রিপোর্ট নিন`,
          en: `${eventsSince} new transaction(s) on this dag since the report — get a new report`,
          events_since: eventsSince,
        },
    untouched: untouched
      ? { ok: true, bn: "রিপোর্ট দেওয়ার ঘটনা অডিট লগে আছে, লগের শৃঙ্খল অক্ষত", en: "The issue of this report is in the audit log, and the log's chain is intact" } // prettier-ignore
      : {
          ok: false,
          bn: chain.ok
            ? "এই রিপোর্ট দেওয়ার রেকর্ড অডিট লগে পাওয়া যায়নি"
            : "অডিট লগের শৃঙ্খল ভাঙা — কর্মকর্তাকে জানান",
          en: chain.ok
            ? "No record of issuing this report was found in the audit log"
            : "The audit log's chain is broken — tell an officer",
        },
    shares_add_up: sharesOk
      ? { ok: true, bn: "সব মালিকের অংশ যোগ করলে দাগের মোট জমির সমান", en: "All holders' shares add up to the dag's area" } // prettier-ignore
      : { ok: false, bn: "অংশের যোগফল দাগের জমির সাথে মেলে না, বা কেউ অংশের বেশি বিক্রি করেছেন", en: "The shares do not add up to the dag's area, or someone sold more than their share" }, // prettier-ignore
  };

  const allOk = current && untouched && sharesOk;
  return {
    overall: allOk ? "green" : "amber",
    overall_bn: allOk
      ? "আসল এবং হালনাগাদ"
      : current
        ? "আসল, তবে একটি সতর্কতা আছে"
        : "আসল, তবে পুরনো — এর পরে দাগে নতুন লেনদেন হয়েছে",
    overall_en: allOk
      ? "GENUINE + CURRENT"
      : current
        ? "GENUINE, WITH A WARNING"
        : "GENUINE BUT SUPERSEDED",
    lights,
    payload,
    dag_id: dag?.id ?? null,
  };
}

const bnDigits = (n: number) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);
