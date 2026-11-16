import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { chargeSandbox, sandboxRef } from "@/lib/adapters/payment";
import { parseDocCode, signDocument } from "@/lib/engines/documents";
import { APPLICATION_TYPES, feeFor, SERVICE_AREAS } from "@/lib/services/catalog";

process.env.SEAL_PRIVATE_KEY ??= generateKeyPairSync("ed25519")
  .privateKey.export({ format: "der", type: "pkcs8" })
  .toString("base64");

describe("service catalogue", () => {
  it("lists the 11 land services, each with Bangla and English names", () => {
    expect(SERVICE_AREAS).toHaveLength(11);
    for (const a of SERVICE_AREAS) {
      expect(a.bn).toMatch(/[ঀ-৿]/);
      expect(a.en).toMatch(/[A-Za-z]/);
      for (const t of a.types) expect(APPLICATION_TYPES[t].area).toBe(a.id);
    }
  });

  it("takes the certified-copy fee from the official fee list", () => {
    const base = { mouza: "Nayapara", dag_no: 141, survey: "BS" as const };
    expect(feeFor("certified_copy", { ...base, delivery: "online" }).map((l) => l.tk)).toEqual([
      100,
    ]);
    expect(feeFor("certified_copy", { ...base, delivery: "post" }).map((l) => l.tk)).toEqual([
      100, 40,
    ]);
  });
});

describe("sandbox payment", () => {
  it("makes readable receipt numbers and never takes a bad amount", () => {
    expect(sandboxRef(Buffer.alloc(10, 0))).toBe("SBX-AAAAAAAAAA");
    expect(chargeSandbox(140, "bkash")).toMatchObject({ amount_taka: 140, status: "paid", sandbox: true }); // prettier-ignore
    expect(() => chargeSandbox(0, "bkash")).toThrow();
    expect(() => chargeSandbox(10.5, "card")).toThrow();
  });
});

describe("signed documents", () => {
  it("round-trips a code and rejects other prefixes", () => {
    const doc = signDocument({
      kind: "khatian_copy",
      app_no: "CPY-2026-0001",
      mouza_bn: "নয়াপাড়া",
      mouza_en: "Nayapara",
      jl_no: 45,
      dag_no: 141,
      survey: "BS",
      year: 1998,
      khatian_no: 205,
      area_dec: 33,
      owners: [{ name_bn: "ক", name_en: "K", share_dec: 33 }],
      ledger_version: 0,
    });
    expect(doc.code.startsWith("BD1.")).toBe(true);
    expect(parseDocCode(doc.code)?.payload.app_no).toBe("CPY-2026-0001");
    expect(parseDocCode(`https://x/verify/doc#${doc.code}`)?.payload.id).toBe(doc.payload.id);
    expect(parseDocCode(doc.code.replace("BD1.", "BS1."))).toBeNull();
  });
});
