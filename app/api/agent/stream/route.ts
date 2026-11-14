import { runAgent } from "@/lib/ai/agent";
import { finalPayload, parseAgentRequest, toBadge } from "@/lib/ai/agent-request";
import { describeWithNames } from "@/lib/ai/describe";
import { AiNotConfiguredError, getProvider } from "@/lib/ai/provider";

// POST /api/agent/stream → one agent turn as a stream of JSON lines (NDJSON):
//   {"type":"text","delta":"…"}        answer text as it is written
//   {"type":"tool","badge":{…}}        a tool finished (shown as a badge)
//   {"type":"pending","action":{…}}    a write action waits for the citizen's Yes/No
//   {"type":"done","result":{…}}       final state: history, reply, sources, badges
//   {"type":"error","error":{bn,en}}   something went wrong

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

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      try {
        const result = await runAgent({
          messages: parsed.messages,
          provider,
          resolvePending: parsed.body.confirm,
          replyLanguage: parsed.body.lang,
          describe: describeWithNames,
          onEvent: (e) => {
            if (e.type === "text") send({ type: "text", delta: e.delta });
            else if (e.type === "tool") send({ type: "tool", badge: toBadge(e.call) });
            else send({ type: "pending", action: e.action });
          },
        });
        send({ type: "done", result: finalPayload(result) });
      } catch (err) {
        console.error("agent stream failed", err);
        send({ type: "error", error: { bn: "দুঃখিত, সাথী এখন উত্তর দিতে পারছে না। একটু পরে চেষ্টা করুন।", en: "Agent failed." } }); // prettier-ignore
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
