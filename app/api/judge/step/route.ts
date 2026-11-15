import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/auth/guard";
import { JUDGE_STEPS, runJudgeStep } from "@/lib/demo/judge";

// POST /api/judge/step {step} → runs ONE fixed step of the judge-mode tour and returns its card.
// Open to everyone on purpose (judges should not need a password), so it is tightly limited:
// only the scripted steps in lib/demo/judge.ts, synthetic data, rate limited per IP, and it can be
// switched off with JUDGE_MODE=off or DEMO_RESET_DISABLED=true.

const body = z.object({
  step: z
    .number()
    .int()
    .min(0)
    .max(JUDGE_STEPS.length - 1),
  // The visitor's language: captions come in both, and the Sathi AI step asks and answers in it.
  lang: z.enum(["bn", "en"]).default("bn"),
});

export async function POST(request: Request) {
  if (process.env.JUDGE_MODE === "off" || process.env.DEMO_RESET_DISABLED === "true") {
    return Response.json({ error: { bn: "জাজ মোড বন্ধ আছে।", en: "Judge mode is off." } }, { status: 403 }); // prettier-ignore
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { bn: "ধাপ নম্বর সঠিক নয়।", en: "Invalid step." } }, { status: 400 }); // prettier-ignore
  }
  const ip = clientIp(request);
  const limited =
    (await rateLimit(`judge:${ip}`, 60, 60)) ??
    (parsed.data.step === 0 ? await rateLimit(`judge-reset:${ip}`, 6, 60) : null);
  if (limited) return limited;
  try {
    const card = await runJudgeStep(parsed.data.step, parsed.data.lang);
    return Response.json({ step: parsed.data.step, total: JUDGE_STEPS.length, card });
  } catch (err) {
    console.error("judge step failed", err);
    const quota = (err as { status?: number })?.status === 429;
    return Response.json(
      {
        error: quota
          ? { bn: "আজকের বিনামূল্যের এআই সীমা শেষ — এই ধাপ বাদ দিয়ে পরের ধাপে যান।", en: "AI quota used up." } // prettier-ignore
          : { bn: "এই ধাপটি চালানো যায়নি — পরের ধাপে যান।", en: "This step failed." },
      },
      { status: quota ? 429 : 500 },
    );
  }
}
