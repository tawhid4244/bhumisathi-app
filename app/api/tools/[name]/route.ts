import { ZodError } from "zod";
import { KhatianNotFoundError } from "@/lib/engines/jomi-check";
import { DagNotFoundError } from "@/lib/engines/ledger";
import { WarishInputError } from "@/lib/engines/warish";
import { UploadError } from "@/lib/adapters/storage";
import { VisionNotConfiguredError } from "@/lib/ai/vision";
import { DeceasedNotFoundError } from "@/lib/engines/warish-land";
import { NoMapError } from "@/lib/engines/map";
import { currentUser } from "@/lib/auth/current";
import { FORBIDDEN, UNAUTHORIZED } from "@/lib/auth/guard";
import { AccessDeniedError, runTool, UnknownToolError } from "@/lib/tools/registry";

// POST /api/tools/{name} with a JSON body → runs that tool from the registry.
// Pages and the AI agent use the same tools, so there is one code path for every feature.
// The caller's role is checked by runTool (e.g. only officers may register a sale).
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
    const result = await runTool(name, body, { user: await currentUser() });
    return Response.json(result);
  } catch (err) {
    if (err instanceof UnknownToolError) {
      return Response.json(
        { error: { bn: "এমন কোনো সেবা নেই।", en: `Unknown tool: ${name}` } },
        { status: 404 },
      );
    }
    if (err instanceof AccessDeniedError) return err.signedIn ? FORBIDDEN() : UNAUTHORIZED();
    if (err instanceof ZodError) {
      return Response.json(
        {
          error: { bn: "তথ্যগুলো সঠিক নয়।", en: "Invalid input." },
          issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
        { status: 400 },
      );
    }
    if (err instanceof UploadError) {
      return Response.json({ error: { bn: "দলিলের ছবি পাওয়া যায়নি। আবার আপলোড করুন।", en: err.message } }, { status: 404 }); // prettier-ignore
    }
    if (err instanceof VisionNotConfiguredError) {
      return Response.json({ error: { bn: "দলিল পড়ার এআই চালু করা হয়নি।", en: err.message } }, { status: 503 }); // prettier-ignore
    }
    if ((err as { status?: number })?.status === 429) {
      return Response.json({ error: { bn: "আজকের বিনামূল্যের এআই সীমা শেষ। পরে আবার চেষ্টা করুন।", en: "AI quota used up for today." } }, { status: 429 }); // prettier-ignore
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
      err instanceof DeceasedNotFoundError ||
      err instanceof NoMapError
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
