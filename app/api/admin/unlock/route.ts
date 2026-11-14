import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { appendAudit } from "@/lib/engines/audit";
import { unlockAccount } from "@/lib/engines/office";

// POST /api/admin/unlock {email} → clear a lockout after too many wrong passwords. Admins only;
// the action itself goes into the audit log.
export async function POST(request: Request) {
  const { user, deny } = await requireRole("admin");
  if (deny) return deny;
  const parsed = z.object({ email: z.string().trim().email().max(200) }).safeParse(await request.json().catch(() => null)); // prettier-ignore
  if (!parsed.success) {
    return Response.json(
      { error: { bn: "ইমেইল সঠিক নয়।", en: "Invalid email." } },
      { status: 400 },
    );
  }
  const ok = await unlockAccount(parsed.data.email);
  if (!ok) return Response.json({ error: { bn: "অ্যাকাউন্ট পাওয়া যায়নি।", en: "No such account." } }, { status: 404 }); // prettier-ignore
  await appendAudit({ user, action: "unlock_account" });
  return Response.json({ ok: true });
}
