import { connection } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { recentActivity } from "@/lib/engines/demo";

// GET /api/demo/activity → mock SMS outbox, mutation cases and ledger events for the demo screen.
// Synthetic data only. Officers and admins only (it names buyers and sellers).
export async function GET() {
  await connection(); // always live, never prerendered
  const { deny } = await requireRole("officer");
  if (deny) return deny;
  return Response.json(await recentActivity());
}
