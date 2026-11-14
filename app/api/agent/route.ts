import { runAgent } from "@/lib/ai/agent";
import { finalPayload, parseAgentRequest } from "@/lib/ai/agent-request";
import { describeWithNames } from "@/lib/ai/describe";
import { knownNames } from "@/lib/ai/pii";
import { AiNotConfiguredError, getProvider } from "@/lib/ai/provider";

// POST /api/agent → one turn of the Sathi agent, as a single JSON response.
// The chat page uses /api/agent/stream (same request, streamed events).
// Task 16 adds rate limiting; task 10 adds PII masking.

export async function POST(request: Request) {
  const parsed = parseAgentRequest(await request.text());
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status });

  let provider;
  try {
    provider = getProvider();
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return Response.json({ error: { bn: "সাথী এআই এখনও চালু করা হয়নি (এআই কী নেই)।", en: err.message } }, { status: 503 }); // prettier-ignore
    }
    throw err;
  }

  try {
    const result = await runAgent({
      messages: parsed.messages,
      provider,
      resolvePending: parsed.body.confirm,
      replyLanguage: parsed.body.lang,
      describe: describeWithNames,
      knownNames: await knownNames(),
    });
    return Response.json(finalPayload(result));
  } catch (err) {
    console.error("agent failed", err);
    return Response.json({ error: { bn: "দুঃখিত, সাথী এখন উত্তর দিতে পারছে না। একটু পরে চেষ্টা করুন।", en: "Agent failed." } }, { status: 502 }); // prettier-ignore
  }
}
