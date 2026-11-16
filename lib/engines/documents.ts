import { createHash, randomBytes, sign, verify } from "node:crypto";
import { getSql } from "../sql";
import { verifyAuditChain } from "./audit";
import { resolveDag } from "./ledger";
import { sealKeys } from "./seal";

// Signed documents issued by the application framework (certified khatian copy now; dakhila and
// mutation order in Phase C). Same Ed25519 key as BhumiSeal, different prefix:
//
//   code = "BD1." + base64url(payload JSON) + "." + base64url(signature of those bytes)
//
// /verify/doc shows four lights:
//   1. genuine    — signed with BhumiSathi's key, nothing changed
//   2. on record  — the office issued it (issued_documents row, same payload hash, not revoked)
//   3. untouched  — the issue is in the hash-chained audit log and the chain is intact
//   4. current    — nothing new recorded on the dag since (a later sale makes an old copy stale)

export const DOC_PREFIX = "BD1";

export interface KhatianCopyPayload {
  v: 1;
  id: string;
  kid: string;
  kind: "khatian_copy";
  issued_at: string;
  app_no: string;
  mouza_bn: string;
  mouza_en: string;
  jl_no: number;
  dag_no: number;
  survey: "CS" | "SA" | "RS" | "BS";
  year: number;
  khatian_no: number;
  area_dec: number;
  owners: { name_bn: string; name_en: string; share_dec: number }[];
  ledger_version: number;
}

export type DocPayload = KhatianCopyPayload;

export const DOC_KIND_LABEL: Record<DocPayload["kind"], { bn: string; en: string }> = {
  khatian_copy: { bn: "খতিয়ানের সার্টিফাইড কপি", en: "Certified khatian copy" },
};

const b64u = (b: Buffer) => b.toString("base64url");
export const sha256hex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/** Sign a payload (id and kid are filled in here). */
export function signDocument(
  body: Omit<DocPayload, "v" | "id" | "kid" | "issued_at">,
  now = new Date(),
): { code: string; payload: DocPayload; payload_sha256: string } {
  const { priv, kid } = sealKeys();
  const payload = {
    v: 1,
    id: randomBytes(8).toString("hex"),
    kid,
    issued_at: now.toISOString(),
    ...body,
  } as DocPayload;
  const json = JSON.stringify(payload);
  const sig = sign(null, Buffer.from(json, "utf8"), priv);
  return {
    code: `${DOC_PREFIX}.${b64u(Buffer.from(json, "utf8"))}.${b64u(sig)}`,
    payload,
    payload_sha256: sha256hex(json),
  };
}

export function parseDocCode(
  code: string,
): { json: string; sig: Buffer; payload: DocPayload } | null {
  // prettier-ignore
  const raw = code.trim().replace(/^.*[#?]/, "");
  const parts = raw.split(".");
  if (parts.length !== 3 || parts[0] !== DOC_PREFIX) return null;
  try {
    const json = Buffer.from(parts[1]!, "base64url").toString("utf8");
    const payload = JSON.parse(json) as DocPayload;
    if (payload?.v !== 1 || typeof payload.id !== "string" || !(payload.kind in DOC_KIND_LABEL)) return null; // prettier-ignore
    return { json, sig: Buffer.from(parts[2]!, "base64url"), payload };
  } catch {
    return null;
  }
}

type Light = { ok: boolean; bn: string; en: string };

export interface DocCheck {
  overall: "green" | "amber" | "red";
  overall_bn: string;
  overall_en: string;
  lights: { genuine: Light; on_record: Light; untouched: Light; current: Light };
  payload: DocPayload | null;
}

const UNCHECKED: Light = { ok: false, bn: "যাচাই করা যায়নি", en: "Could not be checked" };

export async function verifyDocument(code: string): Promise<DocCheck> {
  const parsed = parseDocCode(code);
  if (!parsed) {
    return {
      overall: "red",
      overall_bn: "এটি ভূমিসাথীর ডকুমেন্ট নয়",
      overall_en: "NOT A BHUMISATHI DOCUMENT",
      lights: { genuine: { ok: false, bn: "কোডটি পড়া যায়নি", en: "The code could not be read" }, on_record: UNCHECKED, untouched: UNCHECKED, current: UNCHECKED }, // prettier-ignore
      payload: null,
    };
  }
  const { json, sig, payload } = parsed;
  const { pub, kid } = sealKeys();
  let genuine = false;
  try {
    genuine = payload.kid === kid && sig.length === 64 && verify(null, Buffer.from(json, "utf8"), pub, sig); // prettier-ignore
  } catch {
    genuine = false;
  }
  if (!genuine) {
    return {
      overall: "red",
      overall_bn: "আসল নয় — ডকুমেন্টটি বদলানো হয়েছে বা নকল",
      overall_en: "NOT GENUINE",
      lights: { genuine: { ok: false, bn: "স্বাক্ষর মেলেনি: কোনো তথ্য বদলানো হয়েছে", en: "The signature does not match: something was changed" }, on_record: UNCHECKED, untouched: UNCHECKED, current: UNCHECKED }, // prettier-ignore
      payload,
    };
  }

  const sql = getSql();
  const hash = sha256hex(json);
  const [row] = await sql<{ revoked: boolean; payload_sha256: string }[]>`
    select revoked, payload_sha256 from issued_documents where id = ${payload.id}`;
  const onRecord = !!row && !row.revoked && row.payload_sha256 === hash;
  const [audit] = await sql<{ n: number }[]>`
    select count(*)::int as n from audit_log
    where action = 'doc_issue' and detail->>'doc_id' = ${payload.id}
      and detail->>'payload_sha256' = ${hash}`;
  const chain = await verifyAuditChain();
  const untouched = (audit?.n ?? 0) > 0 && chain.ok;
  const dag = await resolveDag(payload.mouza_en, payload.dag_no).catch(() => null);
  const current = !!dag && dag.version === payload.ledger_version;

  const lights: DocCheck["lights"] = {
    genuine: { ok: true, bn: "ভূমিসাথীর চাবি দিয়ে স্বাক্ষরিত; কোনো তথ্য বদলানো হয়নি", en: "Signed with BhumiSathi's key; nothing was changed" }, // prettier-ignore
    on_record: onRecord
      ? { ok: true, bn: `অফিসের রেকর্ডে আছে (আবেদন ${payload.app_no})`, en: `In the office's records (application ${payload.app_no})` } // prettier-ignore
      : { ok: false, bn: row?.revoked ? "এই ডকুমেন্ট বাতিল করা হয়েছে" : "অফিসের রেকর্ডে এই ডকুমেন্ট পাওয়া যায়নি", en: row?.revoked ? "This document was revoked" : "This document is not in the office's records" }, // prettier-ignore
    untouched: untouched
      ? { ok: true, bn: "ইস্যুর ঘটনা অডিট লগে আছে, লগের শৃঙ্খল অক্ষত", en: "The issue is in the audit log, and the log's chain is intact" } // prettier-ignore
      : { ok: false, bn: chain.ok ? "ইস্যুর রেকর্ড অডিট লগে পাওয়া যায়নি" : "অডিট লগের শৃঙ্খল ভাঙা — কর্মকর্তাকে জানান", en: chain.ok ? "No record of the issue in the audit log" : "The audit log's chain is broken — tell an officer" }, // prettier-ignore
    current: current
      ? { ok: true, bn: "ইস্যুর পরে এই দাগে নতুন কিছু নিবন্ধিত হয়নি", en: "Nothing new registered on this dag since it was issued" } // prettier-ignore
      : { ok: false, bn: "ইস্যুর পরে এই দাগে নতুন লেনদেন হয়েছে — নতুন কপি নিন", en: "New transactions on this dag since it was issued — get a new copy" }, // prettier-ignore
  };
  const all = onRecord && untouched && current;
  return {
    overall: all ? "green" : "amber",
    overall_bn: all ? "আসল এবং হালনাগাদ" : onRecord && untouched ? "আসল, তবে পুরনো" : "আসল স্বাক্ষর, তবে একটি সতর্কতা আছে", // prettier-ignore
    overall_en: all ? "GENUINE + CURRENT" : onRecord && untouched ? "GENUINE BUT SUPERSEDED" : "GENUINE SIGNATURE, WITH A WARNING", // prettier-ignore
    lights,
    payload,
  };
}
