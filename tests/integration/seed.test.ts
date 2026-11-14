import { afterAll, describe, expect, it } from "vitest";
import { buildWorld, TABLE_ORDER } from "@/scripts/seed-data";
import { seed } from "@/scripts/seed";
import { closeSql, getSql } from "@/lib/sql";

const sql = getSql();
afterAll(() => closeSql());

/** One md5 per table over every row's full text, in a fixed order. */
async function fingerprint(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const table of TABLE_ORDER) {
    const [row] = await sql.unsafe(
      `select coalesce(md5(string_agg(t::text, '|' order by t::text)), '') as h from ${table} t`,
    );
    out[table] = row!.h as string;
  }
  return out;
}

describe("synthetic seed", () => {
  it("builds identical rows in memory every time", () => {
    expect(buildWorld(2026)).toEqual(buildWorld(2026));
  });

  it("running the seed twice gives identical data", async () => {
    await seed(sql);
    const first = await fingerprint();
    await seed(sql);
    const second = await fingerprint();
    expect(second).toEqual(first);
  });

  it("every seeded row is marked synthetic", async () => {
    for (const table of TABLE_ORDER) {
      const [row] = await sql.unsafe(
        `select count(*)::int as n from ${table} where not is_synthetic`,
      );
      expect(row!.n, table).toBe(0);
    }
  });

  it("matches the golden scenario world", async () => {
    const [dag145] = await sql`
      select d.recorded_area_dec::float as area, s.share_dec::float as share, o.name_en
      from dags d
      join ownership_shares s on s.dag_id = d.id
      join khatians k on k.id = s.khatian_id and k.survey = 'BS'
      join owners o on o.id = s.owner_id
      where d.id = 1145`;
    expect(dag145).toMatchObject({ area: 20, share: 20, name_en: "Md. Rahim Uddin" });

    const [deed] = await sql`
      select d.area_dec::float as area, k.khatian_no, dg.dag_no
      from deeds d join khatians k on k.id = d.khatian_id join dags dg on dg.id = d.dag_id
      where d.deed_no = '4512/2024'`;
    expect(deed).toMatchObject({ area: 8, khatian_no: 210, dag_no: 143 });

    const counts = await sql`select
      (select count(*)::int from dags) as dags,
      (select count(*)::int from khas_flags where dag_id = 1149) as khas,
      (select count(*)::int from liens where dag_id = 1146 and status = 'active') as liens,
      (select count(*)::int from court_cases where dag_id = 1142 and status = 'pending') as cases`;
    expect(counts[0]).toEqual({ dags: 60, khas: 1, liens: 1, cases: 1 });

    const heirsDags = await sql`
      select d.dag_no, s.share_dec::float as share
      from ownership_shares s join khatians k on k.id = s.khatian_id and k.survey = 'BS'
      join dags d on d.id = s.dag_id
      where s.owner_id = 5 order by d.dag_no`;
    expect(heirsDags).toEqual([
      { dag_no: 210, share: 60 },
      { dag_no: 211, share: 40 },
    ]);
  });

  it("the database refuses a real-looking NID or phone number", async () => {
    await expect(
      sql`insert into owners (id, kind, name_bn, name_en, nid)
          values (999, 'person', 'পরীক্ষা', 'Test', '1990123456789')`,
    ).rejects.toThrow(/owners_nid_check/);
    await expect(
      sql`insert into owners (id, kind, name_bn, name_en, phone)
          values (999, 'person', 'পরীক্ষা', 'Test', '+8801712345678')`,
    ).rejects.toThrow(/owners_phone_check/);
  });
});
