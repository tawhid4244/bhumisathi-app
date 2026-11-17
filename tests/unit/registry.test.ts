import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  defineTool,
  runTool,
  SYSTEM,
  tools,
  toolsFor,
  type ToolDefinition,
} from "@/lib/tools/registry";

const echo = defineTool({
  name: "echo_dag",
  kind: "read",
  description: { bn: "দাগ নম্বর ফেরত দেয়", en: "Returns the dag number" },
  input: z.object({ dag: z.number().int().positive() }),
  output: z.object({ dag: z.number() }),
  handler: async ({ dag }) => ({ dag }),
});

const liar = defineTool({
  name: "bad_output",
  kind: "read",
  description: { bn: "ভুল আউটপুট", en: "Returns output that breaks its schema" },
  input: z.object({}),
  output: z.object({ verdict: z.enum(["red", "amber", "green"]) }),
  // Cast on purpose: simulates an engine bug that runTool must catch.
  handler: async () => ({ verdict: "purple" }) as unknown as { verdict: "red" },
});

const registry = [echo, liar] as ToolDefinition[];

describe("tool registry", () => {
  it("runs a tool with valid input", async () => {
    await expect(runTool("echo_dag", { dag: 145 }, SYSTEM, registry)).resolves.toEqual({
      dag: 145,
    });
  });

  it("rejects invalid input before the handler runs (e.g. bad input from the AI)", async () => {
    await expect(
      runTool("echo_dag", { dag: "145; drop table" }, SYSTEM, registry),
    ).rejects.toThrow();
    await expect(runTool("echo_dag", { dag: -1 }, SYSTEM, registry)).rejects.toThrow();
  });

  it("rejects output that breaks the tool's schema", async () => {
    await expect(runTool("bad_output", {}, SYSTEM, registry)).rejects.toThrow();
  });

  it("refuses unknown tools", async () => {
    await expect(runTool("delete_everything", {}, SYSTEM, registry)).rejects.toThrow(
      /Unknown tool/,
    );
  });
});

describe("role-based access (Task 16)", () => {
  const citizen = { id: "c1", email: "c@x.test", name_bn: "ক", role: "citizen" as const };
  const officer = { id: "o1", email: "o@x.test", name_bn: "খ", role: "officer" as const };
  const guarded = defineTool({ ...echo, name: "officer_only", access: "officer" });
  const reg = [echo, guarded] as ToolDefinition[];

  it("refuses an officer-only tool to a visitor (401) and a citizen (403), allows an officer", async () => {
    await expect(runTool("officer_only", { dag: 1 }, { user: null }, reg)).rejects.toMatchObject({ name: "AccessDeniedError", signedIn: false }); // prettier-ignore
    await expect(runTool("officer_only", { dag: 1 }, { user: citizen }, reg)).rejects.toMatchObject({ name: "AccessDeniedError", signedIn: true }); // prettier-ignore
    await expect(runTool("officer_only", { dag: 1 }, { user: officer }, reg)).resolves.toEqual({ dag: 1 }); // prettier-ignore
    await expect(runTool("echo_dag", { dag: 1 }, { user: null }, reg)).resolves.toEqual({ dag: 1 });
  });

  it("only officers and admins may write to the ledger; citizens keep checks and answers", () => {
    const names = (u: typeof citizen | typeof officer | null) => toolsFor(u).map((t) => t.name);
    // Ledger writes are for officers only.
    for (const t of tools.filter((t) => t.kind === "write" && t.name.startsWith("register_"))) {
      expect(t.access).toBe("officer");
    }
    // Other writes (a citizen's own application, a sandbox payment, an officer's decision) are
    // done by the person in the app with their own click: never offered to the AI. The one
    // exception is filing a complaint, which the AI may PROPOSE; like every write it stops at the
    // confirmation card until the citizen presses Yes (tested in agent tests and G11).
    const AI_MAY_PROPOSE = ["complaint_submit"];
    for (const t of tools.filter((t) => t.kind === "write" && !t.name.startsWith("register_"))) {
      expect(t.hiddenFromAgent ?? false).toBe(!AI_MAY_PROPOSE.includes(t.name));
      expect(t.access).not.toBe("public");
    }
    expect(names(null)).not.toContain("deed_read");
    expect(names(null)).toContain("jomi_check");
    expect(names(citizen)).toEqual(
      expect.arrayContaining(["jomi_check", "law_search", "deed_read"]),
    );
    expect(names(citizen).some((n) => n.startsWith("register_"))).toBe(false);
    expect(names(officer)).toEqual(expect.arrayContaining(["register_sale", "register_baina", "register_lien"])); // prettier-ignore
  });
});
