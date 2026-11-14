import { rateLimit, requireRole } from "../auth/guard";
import { LIMITS } from "../security/rate-limit";

// Every AI route starts here: signed-in users only, and a per-user budget so one account
// cannot run up the model bill or starve the free quota (15 turns a minute, 300 a day).
export async function agentGate() {
  const { user, deny } = await requireRole("citizen");
  if (deny) return { deny };
  const limited =
    (await rateLimit(`agent:min:${user.id}`, LIMITS.agent.perMinute, 60)) ??
    (await rateLimit(`agent:day:${user.id}`, LIMITS.agent.perDay, 86_400));
  if (limited) return { deny: limited };
  return { user };
}
