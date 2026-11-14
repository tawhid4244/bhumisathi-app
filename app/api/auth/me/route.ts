import { currentUser } from "@/lib/auth/current";

// GET /api/auth/me → the signed-in user (id, email, Bangla name, role) or null.
export async function GET() {
  return Response.json({ user: await currentUser() }, { headers: { "cache-control": "no-store" } });
}
