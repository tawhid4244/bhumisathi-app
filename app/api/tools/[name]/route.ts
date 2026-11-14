import { ZodError } from "zod";
import { KhatianNotFoundError } from "@/lib/engines/jomi-check";
import { DagNotFoundError } from "@/lib/engines/ledger";
import { WarishInputError } from "@/lib/engines/warish";
import { DeceasedNotFoundError } from "@/lib/engines/warish-land";
import { runTool, UnknownToolError } from "@/lib/tools/registry";

// POST /api/tools/{name} with a JSON body → runs that tool from the registry.
// Pages and the AI agent use the same tools, so there is one code path for every feature.
// Errors never leak stack traces or SQL; they return a short Bangla + English message.

export async function POST(request: Request, ctx: RouteContext<"/api/tools/[name]">) {
  const { name } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { bn: "অনুরোধটি সঠিক JSON নয়।", en: "Request body must be JSON." } },
      { status: 400 },
    );
  }
  try {
    const result = await runTool(name, body);
    return Response.json(result);
  } catch (err) {
    if (err instanceof UnknownToolError) {
      return Response.json(
        { error: { bn: "এমন কোনো সেবা নেই।", en: `Unknown tool: ${name}` } },
        { status: 404 },
      );
    }
    if (err instanceof ZodError) {
      return Response.json(
        {
          error: { bn: "তথ্যগুলো সঠিক নয়।", en: "Invalid input." },
          issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
        { status: 400 },
      );
    }
    if (err instanceof WarishInputError) {
      return Response.json(
        { error: { bn: "পরিবারের তথ্য সঠিক নয়।", en: err.message } },
        { status: 400 },
      );
    }
    if (
      err instanceof DagNotFoundError ||
      err instanceof KhatianNotFoundError ||
      err instanceof DeceasedNotFoundError
    ) {
      return Response.json(
        { error: { bn: "এই মৌজায় দাগ বা খতিয়ানটি পাওয়া যায়নি।", en: err.message } },
        { status: 404 },
      );
    }
    console.error(`tool ${name} failed`, err);
    return Response.json(
      { error: { bn: "দুঃখিত, একটি সমস্যা হয়েছে।", en: "Something went wrong." } },
      { status: 500 },
    );
  }
}
