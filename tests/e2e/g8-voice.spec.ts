import { expect, test, type Page } from "@playwright/test";
import { resetDemo } from "./helpers";

// G8 voice path. A fake speech engine replaces the microphone (it "hears" a fixed sentence) and
// records what Sathi speaks. Everything after that — read-back, agent, tools — is real.

async function fakeVoice(page: Page, transcript: string | null, error?: string) {
  await page.addInitScript(
    ({ transcript, error }) => {
      const w = window as unknown as Record<string, unknown>;
      w.__spoken = [] as string[];
      class FakeRecognition {
        lang = "";
        interimResults = false;
        continuous = false;
        maxAlternatives = 1;
        onresult: ((e: unknown) => void) | null = null;
        onerror: ((e: unknown) => void) | null = null;
        onend: (() => void) | null = null;
        start() {
          (window as unknown as { __recLang: string }).__recLang = this.lang;
          setTimeout(() => {
            if (error) this.onerror?.({ error });
            else this.onresult?.({ results: [[{ transcript }]] });
            this.onend?.();
          }, 50);
        }
        stop() {
          this.onend?.();
        }
        abort() {}
      }
      w.webkitSpeechRecognition = FakeRecognition;
      w.SpeechRecognition = FakeRecognition;
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true,
        value: {
          speak: (u: { text: string }) => (w.__spoken as string[]).push(u.text),
          cancel: () => {},
          getVoices: () => [],
        },
      });
    },
    { transcript, error },
  );
}

const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken); // prettier-ignore

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
});

test("G8 voice: Sathi reads the dag number back, then checks it and speaks the answer", async ({
  page,
}) => {
  await fakeVoice(page, "১৪৫ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও");
  await page.goto("/chat");
  await page.getByRole("button", { name: "কথা বলুন" }).click();

  const card = page.getByTestId("readback-card");
  await expect(card).toContainText("আপনি কি ১৪৫ নম্বর দাগ বলেছেন? ঠিক আছে?");
  await expect(card).toContainText("১৪৫ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও");
  expect(await spoken(page)).toContain("আপনি কি ১৪৫ নম্বর দাগ বলেছেন? ঠিক আছে?");
  expect(await page.evaluate(() => (window as unknown as { __recLang: string }).__recLang)).toBe("bn-BD"); // prettier-ignore
  // Nothing has been sent yet.
  await expect(page.locator('[data-role="assistant"]')).toHaveCount(0);

  await card.getByRole("button", { name: "হ্যাঁ, পাঠান" }).click();
  const answer = page.locator('[data-role="assistant"]').last();
  await expect(answer.locator('[data-tool="jomi_check"]')).toBeVisible();
  await expect(answer).toContainText("সবুজ");
  // Same verdict as /check, and the answer was read aloud.
  await expect(answer.locator("[data-chat-verdict]")).toHaveAttribute("data-chat-verdict", "green");
  await expect.poll(async () => (await spoken(page)).some((s) => s.includes("সবুজ"))).toBe(true);
});

test("'না, ঠিক করি' puts the heard text in the box and sends nothing", async ({ page }) => {
  await fakeVoice(page, "১৫৪ নম্বর দাগ দেখাও");
  await page.goto("/chat");
  await page.getByRole("button", { name: "কথা বলুন" }).click();
  await page.getByTestId("readback-card").getByRole("button", { name: "না, ঠিক করি" }).click();
  await expect(page.getByRole("textbox")).toHaveValue("১৫৪ নম্বর দাগ দেখাও");
  await expect(page.locator('[data-role="assistant"]')).toHaveCount(0);
});

test("no numbers heard → sent straight away", async ({ page }) => {
  await fakeVoice(page, "নামজারি করতে কী কী লাগবে আর খরচ কত");
  await page.goto("/chat");
  await page.getByRole("button", { name: "কথা বলুন" }).click();
  await expect(page.getByTestId("readback-card")).toHaveCount(0);
  await expect(page.locator('[data-role="assistant"]').last()).toContainText("১,১৭০");
});

test("microphone blocked → a clear message, typing still works", async ({ page }) => {
  await fakeVoice(page, null, "not-allowed");
  await page.goto("/chat");
  await page.getByRole("button", { name: "কথা বলুন" }).click();
  await expect(page.getByText("মাইক্রোফোন চালু করতে ব্রাউজারে অনুমতি দিন", { exact: false })).toBeVisible();
  await page.getByRole("textbox").fill("১৪৫ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-role="assistant"]').last()).toContainText("সবুজ");
});

test("browser without speech recognition → no mic button, typed chat only", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.webkitSpeechRecognition;
    delete w.SpeechRecognition;
  });
  await page.goto("/chat");
  await expect(page.getByRole("button", { name: "পাঠান" })).toBeVisible();
  await expect(page.getByRole("button", { name: "কথা বলুন" })).toHaveCount(0);
});
