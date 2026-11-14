import { z } from "zod";
import { runAgent } from "@/lib/ai/agent";
import { describeWithNames } from "@/lib/ai/describe";
import { AiNotConfiguredError, getProvider, type AgentMessage } from "@/lib/ai/provider";

// POST /api/agent → one turn of the Sathi agent.
// Body: { messages: previous history, message?: new user text, confirm?: { tool_use_id, approved } }
// The browser keeps the history and sends it back each turn (the server stores nothing).
// Size limits stop abuse; task 16 adds rate limiting and task 10 adds PII masking.

const MAX_BODY_BYTES = 400_000;

const bodySchema = z
  .object({
    messages: z.array(z.any()).max(80).default([]),
    message: z.string().trim().min(1).max(1000).optional(),
    confirm: z
      .object({ tool_use_id: z.string().min(1).max(100), approved: z.boolean() })
      .optional(),
  })
  .refine((b) => (b.message ? 1 : 0) + (b.confirm ? 1 : 0) === 1, {
    message: "Send either a message or a confirmation.",
  });

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return Response.json({ error: { bn: "কথোপকথন খুব বড় হয়ে গেছে। নতুন করে শুরু করুন।", en: "Conversation too long." } }, { status: 413 }); // prettier-ignore
  }
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(JSON.parse(raw));
  } catch {
    return Response.json({ error: { bn: "অনুরোধটি সঠিক নয়।", en: "Invalid request." } }, { status: 400 }); // prettier-ignore
  }

  let provider;
  try {
    provider = getProvider();
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return Response.json({ error: { bn: "সাথী এআই এখনও চালু করা হয়নি (এআই কী নেই)।", en: err.message } }, { status: 503 }); // prettier-ignore
    }
    throw err;
  }

  const history = parsed.messages as AgentMessage[];
  const messages: AgentMessage[] = parsed.message
    ? [...history, { role: "user", content: parsed.message }]
    : history;

  try {
    const result = await runAgent({
      messages,
      provider,
      resolvePending: parsed.confirm,
      describe: describeWithNames,
    });
    return Response.json(result);
  } catch (err) {
    console.error("agent failed", err);
    return Response.json({ error: { bn: "দুঃখিত, সাথী এখন উত্তর দিতে পারছে না। একটু পরে চেষ্টা করুন।", en: "Agent failed." } }, { status: 502 }); // prettier-ignore
  }
}
