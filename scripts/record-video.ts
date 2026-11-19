// Records the screen clips for the submission video with Playwright (local dev server, demo data).
// Run: npx tsx --env-file-if-exists=.env.local scripts/record-video.ts [s1 s2 …]
// Output: ../video/screen/raw/<shot>.webm + offsets.json (seconds to trim from the start).
// The demo password is read from .env.local and never printed.
import { mkdirSync, renameSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";

const BASE = process.env.RECORD_BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve(process.cwd(), "../video/screen/raw");
const PHONE = { width: 412, height: 915 };
const SCALE = 2;
mkdirSync(OUT, { recursive: true });
const offsetsFile = path.join(OUT, "offsets.json");
const offsets: Record<string, number> = existsSync(offsetsFile) ? JSON.parse(readFileSync(offsetsFile, "utf8")) : {}; // prettier-ignore

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A soft "touch" dot that glides to each tap target (Playwright videos have no cursor), and the
// Next.js dev badge hidden.
const OVERLAY = `
  globalThis.__name = globalThis.__name || ((f) => f); // tsx names inner functions in page.evaluate
  addEventListener("DOMContentLoaded", () => {
    const s = document.createElement("style");
    s.textContent = "nextjs-portal{display:none!important}#rec-dot{position:fixed;z-index:2147483647;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:rgba(13,122,88,.28);border:2px solid rgba(255,255,255,.95);box-shadow:0 2px 10px rgba(0,0,0,.35);pointer-events:none;transition:left .55s cubic-bezier(.4,0,.2,1),top .55s cubic-bezier(.4,0,.2,1),transform .18s;left:70%;top:85%;opacity:0}#rec-dot.on{opacity:1}#rec-dot.press{transform:scale(.7);background:rgba(13,122,88,.55)}";
    document.head.appendChild(s);
    const d = document.createElement("div"); d.id = "rec-dot"; document.body.appendChild(d);
  });`;

async function tap(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (box) {
    await page.evaluate(({ x, y }) => {
      const d = document.getElementById("rec-dot");
      if (!d) return;
      d.classList.add("on");
      d.style.left = `${x}px`;
      d.style.top = `${y}px`;
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 }); // prettier-ignore
    await wait(650);
    await page.evaluate(() => document.getElementById("rec-dot")?.classList.add("press"));
    await wait(180);
    await page.evaluate(() => document.getElementById("rec-dot")?.classList.remove("press"));
  }
  await target.click();
}

/** Smooth scroll so the target sits about a quarter from the top (or to a y position). */
async function glide(page: Page, to: Locator | number, ms = 1600) {
  const y =
    typeof to === "number"
      ? to
      : await to.evaluate((el) => el.getBoundingClientRect().top + scrollY - innerHeight * 0.22);
  await page.evaluate(
    ({ y, ms }) =>
      new Promise<void>((done) => {
        const from = scrollY;
        const t0 = performance.now();
        const step = (t: number) => {
          const p = Math.min(1, (t - t0) / ms);
          const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
          scrollTo(0, from + (y - from) * e);
          if (p < 1) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      }),
    { y: Math.max(0, y), ms },
  );
}

async function typeSlow(page: Page, box: Locator, text: string) {
  await tap(page, box);
  await box.pressSequentially(text, { delay: 55 });
}

async function login(browser: Browser, email: string): Promise<string> {
  const file = path.join(OUT, `.auth-${email.split("@")[0]}.json`);
  const ctx = await browser.newContext({ baseURL: BASE });
  const res = await ctx.request.post("/api/auth/login", { data: { email, password: process.env.DEMO_USER_PASSWORD } }); // prettier-ignore
  if (!res.ok()) throw new Error(`login failed for ${email}: ${res.status()}`);
  await ctx.storageState({ path: file });
  await ctx.close();
  return file;
}

async function resetDemo(browser: Browser, adminState: string) {
  const ctx = await browser.newContext({ baseURL: BASE, storageState: adminState });
  const res = await ctx.request.post("/api/demo/reset");
  if (!res.ok()) throw new Error(`reset failed: ${res.status()}`);
  await ctx.close();
}

/** Open every page once so the dev server has compiled it before the camera rolls. */
async function warm(browser: Browser, state: string) {
  const ctx = await browser.newContext({ baseURL: BASE, storageState: state });
  const p = await ctx.newPage();
  for (const u of [
    "/",
    "/services",
    "/judge",
    "/chat",
    "/check?mouza=nayapara&by=dag&no=141",
    "/verify",
    "/verify/doc",
    "/land-tax",
    "/my",
  ]) {
    // prettier-ignore
    await p.goto(u, { waitUntil: "networkidle", timeout: 120_000 }).catch(() => {});
  }
  await ctx.close();
}

type Shot = (page: Page) => Promise<void>;

async function record(
  browser: Browser,
  name: string,
  shot: Shot,
  opts: { state?: string; desktop?: boolean } = {},
) {
  // prettier-ignore
  const viewport = opts.desktop ? { width: 1920, height: 1080 } : PHONE;
  const scale = opts.desktop ? 1 : SCALE;
  const ctx: BrowserContext = await browser.newContext({
    baseURL: BASE,
    viewport,
    deviceScaleFactor: scale,
    isMobile: !opts.desktop,
    hasTouch: !opts.desktop,
    storageState: opts.state,
    // shortcut: Playwright records at CSS-pixel size (412×915); the phone frame in the edit is ~940 px tall, so it plays near 1:1.
    recordVideo: { dir: OUT, size: viewport },
  });
  await ctx.addInitScript(OVERLAY);
  const t0 = Date.now();
  const page = await ctx.newPage();
  let ready = 0;
  const mark = () => (ready = (Date.now() - t0) / 1000);
  (page as unknown as { mark: () => void }).mark = mark;
  try {
    await shot(page);
  } catch (err) {
    console.error(`✗ ${name}:`, (err as Error).message.split("\n")[0]);
  }
  await wait(1500);
  const video = page.video();
  await ctx.close();
  const file = await video!.path();
  renameSync(file, path.join(OUT, `${name}.webm`));
  offsets[name] = Math.max(0, ready - 0.3);
  writeFileSync(offsetsFile, JSON.stringify(offsets, null, 2));
  console.log(`✓ ${name} (start at ${offsets[name]!.toFixed(1)} s)`);
}

const ready = (page: Page) => (page as unknown as { mark: () => void }).mark();
const lastAnswer = (page: Page) => page.locator('[data-role="assistant"]').last();

const SHOTS: Record<
  string,
  { run: Shot; who?: "citizen"; desktop?: boolean; resetBefore?: boolean }
> = {
  // prettier-ignore
  s1: {
    run: async (page) => {
      await page.goto("/", { waitUntil: "networkidle" });
      ready(page);
      await wait(2500);
      await glide(page, 700, 3500);
      await wait(1200);
      await glide(page, page.getByTestId("services"), 3500);
      await wait(2500);
    },
  },
  s2: {
    run: async (page) => {
      await page.goto("/services", { waitUntil: "networkidle" });
      ready(page);
      await wait(2000);
      await glide(page, 900, 4000);
      await wait(1000);
      await glide(page, 2200, 4000);
      await wait(2000);
    },
  },
  s3: {
    run: async (page) => {
      await page.goto("/judge", { waitUntil: "networkidle" });
      ready(page);
      await wait(1500);
      await tap(page, page.getByRole("button", { name: "জাজ মোড শুরু করুন" }));
      const pause = page.getByRole("button", { name: "থামান" });
      await pause.waitFor({ timeout: 30_000 }).catch(() => {});
      if (await pause.isVisible().catch(() => false)) await pause.click();
      const card = page.getByTestId("judge-card").last();
      await card.waitFor({ timeout: 60_000 });
      await wait(2500);
      for (const hold of [3500, 5000, 3500]) {
        // Earlier cards fold into "আগের ধাপগুলো", so wait for the shown card's text to change.
        const before = await page.getByTestId("judge-card").last().innerText();
        await tap(page, page.getByRole("button", { name: "পরের ধাপ" }));
        await page.waitForFunction((t) => { const c = document.querySelectorAll('[data-testid="judge-card"]'); const last = c[c.length - 1] as HTMLElement | undefined; return !!last && last.innerText !== t; }, before, { timeout: 60_000 }); // prettier-ignore
        await glide(page, page.getByTestId("judge-card").last(), 900);
        await wait(hold);
      }
    },
  },
  s4: {
    who: "citizen",
    resetBefore: true,
    run: async (page) => {
      await page.goto("/chat", { waitUntil: "networkidle" });
      ready(page);
      await wait(1500);
      await typeSlow(page, page.getByRole("textbox"), "১৪৫ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও");
      await wait(600);
      await tap(page, page.getByRole("button", { name: "পাঠান" }));
      await lastAnswer(page).getByText(/ফলাফল/).waitFor({ timeout: 60_000 });
      await wait(1200);
      await glide(page, lastAnswer(page), 1200);
      await wait(4500);
    },
  },
  s5: {
    who: "citizen",
    run: async (page) => {
      await page.goto("/check?mouza=nayapara&by=dag&no=141", { waitUntil: "networkidle" });
      await page.locator("[data-verdict]").first().waitFor();
      ready(page);
      await wait(2500);
      const seal = page.getByRole("button", { name: "সিলযুক্ত রিপোর্ট নিন" });
      await glide(page, seal, 2200);
      await wait(700);
      await tap(page, seal);
      await page.getByTestId("seal-qr").waitFor({ timeout: 60_000 });
      await glide(page, page.getByTestId("seal-qr"), 1000);
      await wait(2500);
      await tap(page, page.getByTestId("seal-verify-link"));
      await page.locator("[data-overall]").waitFor({ timeout: 60_000 });
      await wait(1200);
      await glide(page, page.locator("[data-overall]"), 1200);
      await wait(2500);
      await glide(page, page.locator("[data-light]").last(), 1500);
      await wait(3000);
    },
  },
  s6: {
    who: "citizen",
    resetBefore: true,
    run: async (page) => {
      await page.goto("/chat", { waitUntil: "networkidle" });
      ready(page);
      await wait(1500);
      await typeSlow(page, page.getByRole("textbox"), "মিউটেশনে দালাল ৫,০০০ টাকা চেয়েছে");
      await wait(600);
      await tap(page, page.getByRole("button", { name: "পাঠান" }));
      const card = page.getByTestId("confirm-card");
      await card.waitFor({ timeout: 90_000 });
      await glide(page, card, 1000);
      await wait(3000);
      await tap(page, card.getByRole("button", { name: /হ্যাঁ/ }));
      await lastAnswer(page)
        .getByText(/CMP-\d{4}-\d{4}/)
        .first()
        .waitFor({ timeout: 90_000 });
      await glide(page, lastAnswer(page), 1000);
      await wait(4000);
    },
  },
  s7: {
    who: "citizen",
    run: async (page) => {
      await page.goto("/land-tax", { waitUntil: "networkidle" });
      ready(page);
      await wait(1500);
      const dag = page.getByLabel("দাগ নম্বর");
      await glide(page, dag, 1500);
      await typeSlow(page, dag, "১৪৭");
      await tap(page, page.getByRole("button", { name: "কর হিসাব করুন" }));
      const report = page.getByTestId("tax-report").last();
      await report.getByTestId("tax-due").waitFor({ timeout: 60_000 });
      await glide(page, report, 1200);
      await wait(3500);
      await tap(page, report.getByRole("button", { name: "দাখিলা নিন (৳০)" }));
      await page.waitForURL(/\/my\/applications\/LDT-/, { timeout: 60_000 });
      const doc = page.getByTestId("issued-document");
      await doc.waitFor({ timeout: 60_000 });
      await wait(1000);
      await glide(page, doc, 1500);
      await wait(3500);
      await tap(page, doc.getByRole("link", { name: "এখনই যাচাই করুন" }));
      await page.locator("[data-overall]").waitFor({ timeout: 60_000 });
      await wait(1000);
      await glide(page, page.locator("[data-overall]"), 1000);
      await wait(3500);
    },
  },
  s8: {
    desktop: true,
    run: async (page) => {
      await page.goto("https://github.com/tawhid4244/bhumisathi-app/blob/main/docs/ARCHITECTURE.md", { waitUntil: "load", timeout: 90_000 }); // prettier-ignore
      await wait(5000); // the Mermaid diagram renders in a frame
      ready(page);
      await wait(1500);
      const diagram = page.locator("iframe, svg[id^=mermaid], .mermaid").first();
      if (await diagram.count()) await glide(page, diagram, 2500);
      await wait(6000);
      await glide(page, (await page.evaluate(() => scrollY)) + 700, 4000);
      await wait(3000);
    },
  },
};

async function main() {
  const want = process.argv.slice(2).filter((a) => a in SHOTS);
  const names = want.length ? want : Object.keys(SHOTS);
  const browser = await chromium.launch();
  const citizen = await login(browser, "citizen@demo.bhumisathi.test");
  const admin = await login(browser, "admin@demo.bhumisathi.test");
  await resetDemo(browser, admin);
  await warm(browser, citizen);
  for (const n of names) {
    const s = SHOTS[n]!;
    if (s.resetBefore) await resetDemo(browser, admin);
    await record(browser, n, s.run, { state: s.who === "citizen" ? citizen : undefined, desktop: s.desktop }); // prettier-ignore
  }
  await browser.close();
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});
