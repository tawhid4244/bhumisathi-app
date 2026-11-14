import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineTool, runTool, type ToolDefinition } from "@/lib/tools/registry";

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
    await expect(runTool("echo_dag", { dag: 145 }, registry)).resolves.toEqual({ dag: 145 });
  });

  it("rejects invalid input before the handler runs (e.g. bad input from the AI)", async () => {
    await expect(runTool("echo_dag", { dag: "145; drop table" }, registry)).rejects.toThrow();
    await expect(runTool("echo_dag", { dag: -1 }, registry)).rejects.toThrow();
  });

  it("rejects output that breaks the tool's schema", async () => {
    await expect(runTool("bad_output", {}, registry)).rejects.toThrow();
  });

  it("refuses unknown tools", async () => {
    await expect(runTool("delete_everything", {}, registry)).rejects.toThrow(/Unknown tool/);
  });
});
