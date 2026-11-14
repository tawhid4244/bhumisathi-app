import { requireRole } from "@/lib/auth/guard";
import { pruneRateLimits } from "@/lib/security/rate-limit";
import { getSql } from "@/lib/sql";
import { seed } from "@/scripts/seed";

// POST /api/demo/reset → put the synthetic world back to its starting state (the "Reset demo"
// button and the e2e tests). Admins only. Accounts and uploads are kept; only land data resets.
export async function POST() {
  const { deny } = await requireRole("admin");
  if (deny) return deny;
  if (process.env.DEMO_RESET_DISABLED === "true") {
    return Response.json(
      { error: { bn: "রিসেট বন্ধ আছে।", en: "Reset is disabled." } },
      { status: 403 },
    );
  }
  const counts = await seed(getSql());
  await pruneRateLimits();
  return Response.json({ ok: true, counts });
}
