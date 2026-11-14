import { connection } from "next/server";
import { recentActivity } from "@/lib/engines/demo";

// GET /api/demo/activity → mock SMS outbox, mutation cases and ledger events for the demo screen.
// Synthetic data only. Task 16 restricts this to officers.
export async function GET() {
  await connection(); // always live, never prerendered
  return Response.json(await recentActivity());
}
