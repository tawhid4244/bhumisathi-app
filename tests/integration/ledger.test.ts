import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/tools/[name]/route";
import type { SessionUser } from "@/lib/auth/roles";
import { computeSellable, getLedgerStatus, registerEvent } from "@/lib/engines/ledger";
import { closeSql, getSql } from "@/lib/sql";
import { seed } from "@/scripts/seed";
import { OWNER } from "@/scripts/seed-data";

// The route reads the signed-in user from the session cookie. Here we set it directly:
// these tests act as a sub-registry officer unless a test says otherwise.
const OFFICER: SessionUser = { id: "00000000-0000-0000-0000-00000000000f", email: "officer@t.test", name_bn: "কর্মকর্তা", role: "officer" }; // prettier-ignore
let caller: SessionUser | null = OFFICER;
vi.mock("@/lib/auth/current", () => ({ currentUser: async () => caller }));

const sql = getSql();
afterAll(() => closeSql());
beforeEach(async () => {
  caller = OFFICER;
  await seed(sql);
});

/** Call the real API route handler, exactly as the browser or the agent would. */
async function api(name: string, body: unknown) {
  const req = new Request(`http://test/api/tools/${name}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  const res = await POST(req, { params: Promise.resolve({ name }) } as never);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

const dag145 = { mouza: "নয়াপাড়া", dag_no: 145 };
const SELINA = 23;

describe("G1: double sale blocked on dag 145 (through the API)", () => {
  it("runs steps 1–3 with the exact outcomes from the golden scenario", async () => {
    // Before: Rahim holds 20 decimals, all sellable.
    const before = await api("ledger_status", dag145);
    expect(before.status).toBe(200);
    const holders = before.body.holders as { owner_id: number; sellable_dec: number }[];
    expect(holders).toEqual([expect.objectContaining({ owner_id: OWNER.RAHIM, sellable_dec: 20 })]);

    // Step 1: baina B-0021, Buyer A (Salma), 10 dec, 90 days → OK.
    const s1 = await api("register_baina", {
      ...dag145,
      seller_id: OWNER.RAHIM,
      buyer_id: OWNER.SALMA,
      area_dec: 10,
      days: 90,
    });
    expect(s1.body).toMatchObject({ ok: true, ref: "B-0021", version: 1 });
    const sms1 = await sql`select owner_id from sms_log order by id`;
    expect(sms1.map((r) => r.owner_id)).toEqual([OWNER.RAHIM, OWNER.SALMA]);

    // Step 2: sale of 15 dec to Buyer B (Jamal) → BLOCKED with the reason; SMS to Buyer A.
    const s2 = await api("register_sale", {
      ...dag145,
      seller_id: OWNER.RAHIM,
      buyer_id: OWNER.JAMAL,
      area_dec: 15,
    });
    expect(s2.body.ok).toBe(false);
    expect(s2.body.reason_en).toContain("only 10 decimals sellable; 10 reserved by baina B-0021");
    expect(s2.body.reason_bn).toContain("বিক্রয়যোগ্য মাত্র ১০ শতক");
    expect(s2.body.reason_bn).toContain("বায়না B-0021");
    const sms2 = await sql`select owner_id, body_bn from sms_log order by id desc limit 1`;
    expect(sms2[0]).toMatchObject({ owner_id: OWNER.SALMA });
    expect(sms2[0]!.body_bn).toContain("আটকানো হয়েছে");

    // Step 3: sale of 10 dec to Buyer B → OK; mutation case auto-created, 28-day deadline.
    const s3 = await api("register_sale", {
      ...dag145,
      seller_id: OWNER.RAHIM,
      buyer_id: OWNER.JAMAL,
      area_dec: 10,
    });
    expect(s3.body).toMatchObject({ ok: true, version: 2 });
    expect(s3.body.mutation_case).toMatch(/^M-\d{4}-0001$/);
    const [mc] = await sql`
      select status, (deadline_on - filed_on) as days, to_owner_id from mutation_cases`;
    expect(mc).toMatchObject({ status: "pending", days: 28, to_owner_id: OWNER.JAMAL });

    // After: nothing left to sell (10 sold + 10 reserved for Buyer A).
    const after = await getLedgerStatus("Nayapara", 145);
    expect(after.holders[0]).toMatchObject({ sold_dec: 10, reserved_dec: 10, sellable_dec: 0 });
    expect(after.recent_events.map((e) => e.status)).toEqual(["accepted", "rejected", "accepted"]);
  });

  it("the baina holder can still buy their reserved share", async () => {
    await registerEvent({ type: "baina", mouza: "45", dagNo: 145, ownerId: OWNER.RAHIM, counterpartyId: OWNER.SALMA, area: 10 }); // prettier-ignore
    await registerEvent({ type: "sale", mouza: "45", dagNo: 145, ownerId: OWNER.RAHIM, counterpartyId: OWNER.JAMAL, area: 10 }); // prettier-ignore
    const r = await registerEvent({ type: "sale", mouza: "45", dagNo: 145, ownerId: OWNER.RAHIM, counterpartyId: OWNER.SALMA, area: 10 }); // prettier-ignore
    expect(r.ok).toBe(true);
    const [b] = await sql`select status from bainas where id = 'B-0021'`;
    expect(b!.status).toBe("completed");
  });
});

describe("concurrency: the same share cannot be sold twice at the same moment", () => {
  it("two parallel 10-dec sales after the baina → exactly one succeeds", async () => {
    await registerEvent({ type: "baina", mouza: "Nayapara", dagNo: 145, ownerId: OWNER.RAHIM, counterpartyId: OWNER.SALMA, area: 10 }); // prettier-ignore
    // Two separate connections, as if two sub-registry offices pressed "register" together.
    const sale = (buyer: number) =>
      sql.begin((tx) => tx`select register_event('sale', 1145, ${OWNER.RAHIM}, ${buyer}, 10) as r`);
    const results = await Promise.all([sale(OWNER.JAMAL), sale(OWNER.KARIM_HOSSAIN)]);
    const oks = results.map((rows) => (rows[0]!.r as { ok: boolean }).ok);
    expect(oks.filter(Boolean)).toHaveLength(1);
    const [count] = await sql`select count(*)::int as n from deeds where dag_id = 1145`;
    expect(count!.n).toBe(1);
  });

  it("ten parallel 3-dec sales of a 20-dec share → exactly six succeed (18 dec), never more", async () => {
    const buyers = [2, 3, 4, 6, 7, 8, 9, 20, 21, 22];
    const results = await Promise.all(
      buyers.map((b) =>
        sql.begin((tx) => tx`select register_event('sale', 1145, ${OWNER.RAHIM}, ${b}, 3) as r`),
      ),
    );
    const ok = results.filter((rows) => (rows[0]!.r as { ok: boolean }).ok).length;
    expect(ok).toBe(6);
    const [sold] = await sql`select sum(area_dec)::float8 as s from deeds where dag_id = 1145`;
    expect(sold!.s).toBe(18);
  });
});

describe("other locks", () => {
  it("G4: khas dag 149 cannot be sold or promised", async () => {
    const r = await registerEvent({ type: "sale", mouza: "Nayapara", dagNo: 149, ownerId: OWNER.GOVT, counterpartyId: OWNER.JAMAL, area: 1 }); // prettier-ignore
    expect(r.ok).toBe(false);
    expect(r.reason_bn).toContain("খাস জমি");
  });

  it("G5: dag 142 with a pending civil suit cannot be transferred", async () => {
    const r = await registerEvent({ type: "sale", mouza: "Nayapara", dagNo: 142, ownerId: 21, counterpartyId: OWNER.JAMAL, area: 1 }); // prettier-ignore
    expect(r.ok).toBe(false);
    expect(r.reason_en).toContain("101/2025");
    expect(r.reason_en).toContain("s.52");
  });

  it("G5: dag 146 mortgaged portion cannot be sold without bank release", async () => {
    const status = await getLedgerStatus("Nayapara", 146);
    expect(status.holders[0]).toMatchObject({
      recorded_dec: 20.9,
      locked_dec: 5,
      sellable_dec: 15.9,
    });
    const blocked = await registerEvent({ type: "sale", mouza: "Nayapara", dagNo: 146, ownerId: SELINA, counterpartyId: OWNER.JAMAL, area: 20 }); // prettier-ignore
    expect(blocked.ok).toBe(false);
    expect(blocked.reason_en).toContain("mortgaged to Demo Bank Ltd. (L-0003)");
    const fine = await registerEvent({ type: "sale", mouza: "Nayapara", dagNo: 146, ownerId: SELINA, counterpartyId: OWNER.JAMAL, area: 15.9 }); // prettier-ignore
    expect(fine.ok).toBe(true);
  });

  it("a seller who is not on the latest khatian is refused", async () => {
    const r = await registerEvent({ type: "sale", mouza: "Nayapara", dagNo: 145, ownerId: OWNER.JAMAL, counterpartyId: OWNER.SALMA, area: 1 }); // prettier-ignore
    expect(r.ok).toBe(false);
    expect(r.reason_en).toContain("not on the latest (BS) khatian");
  });

  it("heirs cannot sell in the deceased owner's name (Charpara 210)", async () => {
    const r = await registerEvent({ type: "sale", mouza: "Charpara", dagNo: 210, ownerId: OWNER.ABDUL_KARIM, counterpartyId: OWNER.JAMAL, area: 1 }); // prettier-ignore
    expect(r.ok).toBe(false);
    expect(r.reason_en).toContain("has died");
  });

  it("an expired baina (B-0007 on dag 144) no longer reserves anything", async () => {
    const s = await getLedgerStatus("Nayapara", 144);
    expect(s.holders[0]!.reserved_dec).toBe(0);
    expect(s.active_bainas).toEqual([]);
  });

  it("a lien registered through the ledger locks that portion", async () => {
    const r = await registerEvent({ type: "lien", mouza: "Nayapara", dagNo: 145, ownerId: OWNER.RAHIM, counterpartyId: OWNER.DEMO_BANK, area: 4, ref: "DBL/TEST/1" }); // prettier-ignore
    expect(r).toMatchObject({ ok: true, ref: "L-0004" });
    const s = await getLedgerStatus("Nayapara", 145);
    expect(s.holders[0]).toMatchObject({ locked_dec: 4, sellable_dec: 16 });
  });
});

describe("the SQL view and the TypeScript formula agree for every holder", () => {
  it("matches on all 60 dags", async () => {
    const rows = await sql`
      select recorded_dec::float8 r, sold_dec::float8 s, reserved_dec::float8 b,
             locked_dec::float8 l, sellable_dec::float8 x,
             (is_khas or pending_cases is not null or is_deceased) as blocked
      from share_sellable`;
    expect(rows.length).toBeGreaterThan(60);
    for (const row of rows) {
      expect(
        computeSellable({
          recorded: row.r,
          sold: row.s,
          reserved: row.b,
          locked: row.l,
          blocked: row.blocked,
        }),
      ).toBe(row.x);
    }
  });
});

describe("API input safety", () => {
  it("rejects bad input with 400 and unknown tools with 404", async () => {
    expect(
      (await api("register_sale", { ...dag145, seller_id: "1; drop table deeds" })).status,
    ).toBe(400);
    expect(
      (await api("register_sale", { ...dag145, seller_id: 1, buyer_id: 4, area_dec: -5 })).status,
    ).toBe(400);
    expect((await api("drop_everything", {})).status).toBe(404);
    expect((await api("ledger_status", { mouza: "Nowhere", dag_no: 1 })).status).toBe(404);
  });
});

describe("API access by role (Task 16)", () => {
  const sale = { ...dag145, seller_id: OWNER.RAHIM, buyer_id: OWNER.SALMA, area_dec: 1 };

  it("a visitor gets 401 and a citizen 403 for a sale; the ledger does not change", async () => {
    caller = null;
    expect((await api("register_sale", sale)).status).toBe(401);
    caller = { ...OFFICER, role: "citizen" };
    expect((await api("register_sale", sale)).status).toBe(403);
    expect((await api("register_baina", { ...sale, days: 30 })).status).toBe(403);
    const events = await sql`select count(*)::int as n from ledger_events`;
    expect(events[0]!.n).toBe(0);
  });

  it("public checks still work without signing in", async () => {
    caller = null;
    const r = await api("jomi_check", dag145);
    expect(r.status).toBe(200);
    expect(r.body.verdict).toBeDefined();
  });
});
