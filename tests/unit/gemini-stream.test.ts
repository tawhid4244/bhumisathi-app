import { FinishReason, type GenerateContentResponse } from "@google/genai";
import { describe, expect, it } from "vitest";
import { GeminiProvider, isRoutingStep, joinChunks } from "@/lib/ai/gemini";

// Phase A: streaming, the quick router model for tool-choosing steps, and the first-chunk budget.

const chunk = (parts: unknown[], finishReason?: string) =>
  ({
    candidates: [{ content: { role: "model", parts }, finishReason }],
  }) as GenerateContentResponse;

async function* streamOf(chunks: GenerateContentResponse[], delayMs = 0) {
  for (const c of chunks) {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    yield c;
  }
}

const question = { system: "s", tools: [], messages: [{ role: "user" as const, content: "প্রশ্ন" }] };
const afterTool = {
  system: "s",
  tools: [],
  messages: [
    { role: "user" as const, content: "প্রশ্ন" },
    { role: "assistant" as const, content: [{ type: "tool_use" as const, id: "t1", name: "find_dag", input: {} }] }, // prettier-ignore
    { role: "user" as const, content: [{ type: "tool_result" as const, tool_use_id: "t1", content: "[]" }] }, // prettier-ignore
  ],
};

describe("Gemini streaming", () => {
  it("joins streamed pieces: text merged, calls kept, last finish reason", () => {
    const joined = joinChunks([
      chunk([{ text: "ফলা" }]),
      chunk([{ text: "ফল", thoughtSignature: "S" }]),
      chunk([{ functionCall: { name: "x", args: {} } }], FinishReason.STOP),
    ]);
    const parts = joined.candidates![0]!.content!.parts!;
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({ text: "ফলাফল", thoughtSignature: "S" });
    expect(joined.candidates![0]!.finishReason).toBe(FinishReason.STOP);
  });

  it("sends text to the citizen as it arrives", async () => {
    const seen: string[] = [];
    const p = new GeminiProvider("k", "main", {
      fallbacks: [],
      generateStream: async () => streamOf([chunk([{ text: "এক " }]), chunk([{ text: "দুই" }], FinishReason.STOP)]), // prettier-ignore
    });
    const res = await p.send(afterTool, (t) => seen.push(t));
    expect(seen).toEqual(["এক ", "দুই"]);
    expect(res.content).toMatchObject([{ type: "text", text: "এক দুই" }]);
    expect(res.stop_reason).toBe("end_turn");
  });

  it("uses the quick router model only for tool-choosing steps", async () => {
    const used: string[] = [];
    const p = new GeminiProvider("k", "main", {
      fallbacks: [],
      routerModel: "lite",
      routerSteps: "tools",
      generateStream: async ({ model }) => {
        used.push(model);
        return streamOf([chunk([{ text: "ok" }], FinishReason.STOP)]);
      },
    });
    expect(isRoutingStep(question.messages)).toBe(true);
    expect(isRoutingStep(afterTool.messages)).toBe(false);
    await p.send(question);
    await p.send(afterTool);
    expect(used).toEqual(["lite", "main"]);
  });

  it("by default the quick model is tried first on every step", async () => {
    const used: string[] = [];
    const p = new GeminiProvider("k", "main", {
      fallbacks: [],
      routerModel: "lite",
      generateStream: async ({ model }) => {
        used.push(model);
        return streamOf([chunk([{ text: "ok" }], FinishReason.STOP)]);
      },
    });
    await p.send(question);
    await p.send(afterTool);
    expect(used).toEqual(["lite", "lite"]);
  });

  it("skips a model that does not start answering in time", async () => {
    const used: string[] = [];
    const p = new GeminiProvider("k", "slow", {
      fallbacks: ["fast"],
      firstChunkMs: 50,
      slowFirstChunkMs: 50,
      sleep: async () => {},
      generateStream: async ({ model, config }) => {
        used.push(model);
        const signal = config.abortSignal as AbortSignal;
        if (model === "slow") {
          return (async function* () {
            await new Promise((_, reject) =>
              signal.addEventListener("abort", () => reject(new Error("aborted"))),
            );
            yield chunk([]);
          })();
        }
        return streamOf([chunk([{ text: "দ্রুত" }], FinishReason.STOP)]);
      },
    });
    const res = await p.send(afterTool);
    expect(used).toEqual(["slow", "fast"]);
    expect(res.content).toMatchObject([{ type: "text", text: "দ্রুত" }]);
  });

  it("never switches models after text has been shown", async () => {
    const p = new GeminiProvider("k", "main", {
      fallbacks: ["backup"],
      sleep: async () => {},
      generateStream: async () =>
        (async function* () {
          yield chunk([{ text: "অর্ধেক" }]);
          throw Object.assign(new Error("busy"), { status: 503 });
        })(),
    });
    const seen: string[] = [];
    await expect(p.send(afterTool, (t) => seen.push(t))).rejects.toThrow("busy");
    expect(seen).toEqual(["অর্ধেক"]);
  });
});
