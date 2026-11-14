// Spike: one Bangla question + one tool (jomi_check) → print the tool call the model returns.
// Run: npm run ai:spike   (needs AI_API_KEY in .env.local; costs one small API call)
import { getProvider } from "../lib/ai/provider";
import { toAgentTool } from "../lib/ai/tools";
import { jomiCheckTool } from "../lib/tools/check-tools";
import type { ToolDefinition } from "../lib/tools/types";

async function main() {
  const res = await getProvider().send({
    system: "You are a land helper. Use the tool for facts.",
    tools: [toAgentTool(jomiCheckTool as ToolDefinition)],
    messages: [
      { role: "user", content: "নয়াপাড়া মৌজার ১৪৫ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও" },
    ],
  });
  console.log("stop_reason:", res.stop_reason);
  const calls = res.content.filter((b) => b.type === "tool_use");
  console.log(JSON.stringify(calls, null, 2));
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
