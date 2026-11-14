import { FinishReason, type GenerateContentResponse } from "@google/genai";
import { describe, expect, it } from "vitest";
import {
  fromGeminiResponse,
  GeminiProvider,
  toGeminiContents,
  toGeminiTools,
} from "@/lib/ai/gemini";
import type { AgentMessage } from "@/lib/ai/provider";
import { toAgentTools } from "@/lib/ai/tools";
import { upsertEnv } from "@/lib/env-file";
import { tools } from "@/lib/tools/registry";

const resp = (parts: unknown[], finishReason: string = FinishReason.STOP) =>
  ({
    candidates: [{ content: { role: "model", parts }, finishReason }],
  }) as GenerateContentResponse;

describe("Gemini adapter: response → agent format", () => {
  it("a function call becomes a tool_use block and stop_reason tool_use", () => {
    const r = fromGeminiResponse(
      resp([{ functionCall: { id: "c1", name: "jomi_check", args: { mouza: "Nayapara", dag_no: 145 } }, thoughtSignature: "SIG" }]), // prettier-ignore
      "gemini-test",
    );
    expect(r.stop_reason).toBe("tool_use");
    expect(r.content[0]).toMatchObject({
      type: "tool_use",
      id: "c1",
      name: "jomi_check",
      input: { mouza: "Nayapara", dag_no: 145 },
      _gemini_sig: "SIG",
    });
  });

  it("gives a call an id when Gemini does not", () => {
    const r = fromGeminiResponse(resp([{ functionCall: { name: "find_dag", args: { dag_no: 145 } } }]), "m"); // prettier-ignore
    expect((r.content[0] as { id: string }).id).toMatch(/^gm_/);
  });

  it("plain text → end_turn; internal thought parts are dropped", () => {
    const r = fromGeminiResponse(resp([{ text: "ভাবছি", thought: true }, { text: "সবুজ" }]), "m");
    expect(r.content).toEqual([{ type: "text", text: "সবুজ", citations: null }]);
    expect(r.stop_reason).toBe("end_turn");
  });

  it("safety blocks map to refusal, MAX_TOKENS to max_tokens", () => {
    expect(fromGeminiResponse(resp([], FinishReason.SAFETY), "m").stop_reason).toBe("refusal");
    expect(fromGeminiResponse({ promptFeedback: { blockReason: "OTHER" } } as unknown as GenerateContentResponse, "m").stop_reason).toBe("refusal"); // prettier-ignore
    expect(fromGeminiResponse(resp([{ text: "…" }], FinishReason.MAX_TOKENS), "m").stop_reason).toBe("max_tokens"); // prettier-ignore
  });
});

describe("Gemini adapter: conversation → Gemini contents", () => {
  it("translates text, tool calls (with signature) and tool results with the function name", () => {
    const messages = [
      { role: "user", content: "১৪৫ নম্বর দাগ" },
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "c1",
            name: "find_dag",
            input: { dag_no: 145 },
            _gemini_sig: "SIG",
          },
        ],
      },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "c1", content: '[{"mouza_en":"Nayapara"}]' }],
      },
      { role: "assistant", content: [{ type: "text", text: "নয়াপাড়া" }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "zz", content: "boom", is_error: true }] }, // prettier-ignore
    ] as unknown as AgentMessage[];
    const c = toGeminiContents(messages);
    expect(c.map((x) => x.role)).toEqual(["user", "model", "user", "model", "user"]);
    expect(c[0]!.parts).toEqual([{ text: "১৪৫ নম্বর দাগ" }]);
    expect(c[1]!.parts![0]).toEqual({
      functionCall: { id: "c1", name: "find_dag", args: { dag_no: 145 } },
      thoughtSignature: "SIG",
    });
    expect(c[2]!.parts![0]).toEqual({
      functionResponse: {
        id: "c1",
        name: "find_dag",
        response: { result: [{ mouza_en: "Nayapara" }] },
      },
    });
    expect(c[4]!.parts![0]!.functionResponse!.response).toEqual({ error: "boom" });
  });

  it("every registry tool becomes a function declaration with its JSON schema", () => {
    const decls = toGeminiTools(toAgentTools(tools));
    expect(decls.map((d) => d.name)).toEqual(tools.map((t) => t.name));
    for (const d of decls) expect((d.parametersJsonSchema as { type: string }).type).toBe("object");
  });
});

describe("upsertEnv (used by npm run set-key)", () => {
  const file = "# comment\nNEXT_PUBLIC_SUPABASE_URL=\nAI_PROVIDER=\nAI_API_KEY=\nAI_CHAT_MODEL=\n";

  it("fills existing keys in place and keeps everything else", () => {
    const out = upsertEnv(file, { AI_PROVIDER: "gemini", AI_API_KEY: "k".repeat(30) });
    expect(out).toBe(
      `# comment\nNEXT_PUBLIC_SUPABASE_URL=\nAI_PROVIDER=gemini\nAI_API_KEY=${"k".repeat(30)}\nAI_CHAT_MODEL=\n`,
    );
  });

  it("appends missing keys, removes duplicates, keeps Windows line endings", () => {
    const out = upsertEnv("A=1\r\nAI_API_KEY=old\r\nAI_API_KEY=older\r\n", { AI_API_KEY: "new", AI_PROVIDER: "gemini" }); // prettier-ignore
    expect(out).toBe("A=1\r\nAI_API_KEY=new\r\nAI_PROVIDER=gemini\r\n");
  });
});

describe("Gemini busy handling", () => {
  const ok = (model: string) =>
    ({ candidates: [{ content: { role: "model", parts: [{ text: `from ${model}` }] }, finishReason: "STOP" }] }) as GenerateContentResponse; // prettier-ignore
  const busy = () => Object.assign(new Error("busy"), { status: 503 });
  const req = { system: "s", tools: [], messages: [{ role: "user" as const, content: "hi" }] };

  it("retries once, then moves to the backup model", async () => {
    const calls: string[] = [];
    const p = new GeminiProvider("k", "main", {
      fallbacks: ["backup"],
      sleep: async () => {},
      generate: async ({ model }) => {
        calls.push(model);
        if (model === "main") throw busy();
        return ok(model);
      },
    });
    const r = await p.send(req);
    expect(calls).toEqual(["main", "main", "backup"]);
    expect(r.content[0]).toMatchObject({ text: "from backup" });
    expect(r.model).toBe("backup");
  });

  it("does not retry a bad key or bad request", async () => {
    let n = 0;
    const p = new GeminiProvider("k", "main", {
      sleep: async () => {},
      generate: async () => {
        n++;
        throw Object.assign(new Error("bad key"), { status: 401 });
      },
    });
    await expect(p.send(req)).rejects.toThrow("bad key");
    expect(n).toBe(1);
  });

  it("gives up with the last error when every model is busy", async () => {
    const p = new GeminiProvider("k", "a", {
      fallbacks: ["b"],
      sleep: async () => {},
      generate: async () => {
        throw busy();
      },
    });
    await expect(p.send(req)).rejects.toThrow("busy");
  });
});

describe("Gemini timeouts", () => {
  it("a timeout (504) moves straight to the next model without waiting", async () => {
    const calls: string[] = [];
    let slept = 0;
    const p = new GeminiProvider("k", "slow", {
      fallbacks: ["fast"],
      sleep: async () => {
        slept++;
      },
      generate: async ({ model }) => {
        calls.push(model);
        if (model === "slow") throw Object.assign(new Error("deadline"), { status: 504 });
        return { candidates: [{ content: { role: "model", parts: [{ text: "ok" }] }, finishReason: "STOP" }] } as GenerateContentResponse; // prettier-ignore
      },
    });
    await p.send({ system: "s", tools: [], messages: [{ role: "user", content: "hi" }] });
    expect(calls).toEqual(["slow", "fast"]);
    expect(slept).toBe(0);
  });
});
