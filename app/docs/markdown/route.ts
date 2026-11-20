import { currentUser } from "@/lib/auth/current";
import { toMarkdown } from "@/lib/docs/content";
import { docsLive, docsOpen, getDocsSettings } from "@/lib/engines/docs";

// GET /docs/markdown → the /docs content as a Markdown file, under the same publishing rule.
export async function GET() {
  const [user, settings] = await Promise.all([currentUser(), getDocsSettings()]);
  if (!docsOpen(settings) && user?.role !== "admin") {
    return new Response("Not available", { status: 403 });
  }
  const live = await docsLive().catch(() => [] as [string, number][]);
  return new Response(toMarkdown(live), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": 'attachment; filename="bhumisathi-docs.md"',
    },
  });
}
