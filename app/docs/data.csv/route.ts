import { currentUser } from "@/lib/auth/current";
import { docsLive, docsOpen, getDocsSettings, khatiansBySurvey, toCsv } from "@/lib/engines/docs";
import { tools } from "@/lib/tools/registry";

// GET /docs/data.csv → live numbers, khatians per survey and the feature matrix as one CSV,
// under the same publishing rule as /docs.
export async function GET() {
  const [user, settings] = await Promise.all([currentUser(), getDocsSettings()]);
  if (!docsOpen(settings) && user?.role !== "admin") {
    return new Response("Not available", { status: 403 });
  }
  const [live, surveys] = await Promise.all([
    docsLive().catch(() => [] as [string, number][]),
    khatiansBySurvey().catch(() => []),
  ]);
  const rows: (string | number)[][] = [
    ["section", "name", "value", "detail"],
    ...live.map(([k, v]) => ["live", k, v, ""]),
    ...surveys.map((s) => ["khatians_by_survey", s.survey, s.khatians, ""]),
    ...tools.map((t) => ["tool", t.name, t.kind, `${t.access ?? "public"} · ${t.description.en}`]),
  ];
  return new Response(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="bhumisathi-docs.csv"',
    },
  });
}
