import { getSql } from "@/lib/sql";
import { seed } from "@/scripts/seed";

// POST /api/demo/reset → put the synthetic world back to its starting state (the "Reset demo"
// button and the e2e tests). Synthetic data only. Task 16 limits this to the admin role.
export async function POST() {
  if (process.env.DEMO_RESET_DISABLED === "true") {
    return Response.json(
      { error: { bn: "রিসেট বন্ধ আছে।", en: "Reset is disabled." } },
      { status: 403 },
    );
  }
  const counts = await seed(getSql());
  return Response.json({ ok: true, counts });
}
