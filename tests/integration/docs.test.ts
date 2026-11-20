import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/auth/roles";
import { upsertUser } from "@/lib/auth/session";
import { toMarkdown } from "@/lib/docs/content";
import { docsLive, docsOpen, getDocsSettings, khatiansBySurvey, toCsv } from "@/lib/engines/docs";
import { runTool } from "@/lib/tools/registry";
import { closeSql, getSql } from "@/lib/sql";
import { seed } from "@/scripts/seed";

const sql = getSql();
let admin: SessionUser;
let officer: SessionUser;

beforeAll(async () => {
  await seed(sql);
  const mk = async (email: string, role: "admin" | "officer") => ({
    id: await upsertUser({ email, name_bn: "ক", role, passwordHash: "scrypt$1$1$1$x$y" }),
    email,
    name_bn: "ক",
    role,
  });
  admin = await mk("admin@docs.test", "admin");
  officer = await mk("officer@docs.test", "officer");
});
afterAll(async () => {
  await runTool("docs_settings_update", { visible: true, starts_at: null, ends_at: null }, { user: admin }); // prettier-ignore
  await closeSql();
});

describe("/docs publishing", () => {
  const now = new Date("2026-12-01T12:00:00Z");
  it("window rules: off, before start, after end are closed; inside is open", () => {
    const s = { visible: true, starts_at: null, ends_at: null, updated_at: null };
    expect(docsOpen(s, now)).toBe(true);
    expect(docsOpen({ ...s, visible: false }, now)).toBe(false);
    expect(docsOpen({ ...s, starts_at: "2026-12-02T00:00:00Z" }, now)).toBe(false);
    expect(docsOpen({ ...s, ends_at: "2026-11-30T23:59:00Z" }, now)).toBe(false);
    expect(docsOpen({ ...s, starts_at: "2026-11-30T00:00:00Z", ends_at: "2026-12-05T00:00:00Z" }, now)).toBe(true); // prettier-ignore
  });

  it("only an admin can change it; the change is stored", async () => {
    const input = { visible: false, starts_at: null, ends_at: null };
    await expect(runTool("docs_settings_update", input, { user: null })).rejects.toMatchObject({ name: "AccessDeniedError" }); // prettier-ignore
    await expect(runTool("docs_settings_update", input, { user: officer })).rejects.toMatchObject({ name: "AccessDeniedError" }); // prettier-ignore
    await runTool("docs_settings_update", input, { user: admin });
    expect((await getDocsSettings()).visible).toBe(false);
  });

  it("rejects a window that ends before it starts", async () => {
    const bad = {
      visible: true,
      starts_at: "2026-12-05T00:00:00Z",
      ends_at: "2026-12-01T00:00:00Z",
    };
    await expect(runTool("docs_settings_update", bad, { user: admin })).rejects.toMatchObject({ name: "ZodError" }); // prettier-ignore
  });

  it("live numbers come from the database and go into the Markdown export", async () => {
    const live = await docsLive();
    expect(live.find(([k]) => k.startsWith("Plots"))![1]).toBeGreaterThan(0);
    const md = toMarkdown(live);
    expect(md).toContain("## Live system");
    expect(md).toContain("## Team");
  });
});

describe("/docs exports", () => {
  it("khatians per survey come in CS → SA → RS → BS order", async () => {
    const s = await khatiansBySurvey();
    expect(s.map((r) => r.survey)).toEqual(["CS", "SA", "RS", "BS"]);
    expect(s.every((r) => r.khatians > 0)).toBe(true);
  });

  it("CSV quotes every field and escapes quotes", () => {
    expect(
      toCsv([
        ["a", 1],
        ['say "hi"', "x,y"],
      ]),
    ).toBe('"a","1"\r\n"say ""hi""","x,y"\r\n');
  });
});
