import { expect, test } from "@playwright/test";
import { resetDemo } from "./helpers";

// G2: Abdul Karim (deceased) → wife Rokeya, sons Sohel and Rubel, daughter Nasrin, per dag.
test.beforeEach(async ({ request }) => {
  await resetDemo(request);
});

test("G2: shares per dag, consent by every heir, then the bontonnama checklist", async ({
  page,
}) => {
  await page.goto("/warish");
  await page.getByRole("button", { name: "উদাহরণ: আব্দুল করিমের পরিবার" }).click();
  await page.getByRole("button", { name: "হিসাব করুন" }).click();

  const result = page.getByTestId("warish-result");
  await expect(result).toContainText("আব্দুল করিম-এর জমি");
  // Dag 210 (60 dec): 7.5 / 21 / 21 / 10.5 — dag 211 (40 dec): 5 / 14 / 14 / 7
  const expected: [string, string, string][] = [
    ["wife", "৭.৫ শতক", "৫ শতক"],
    ["son-1", "২১ শতক", "১৪ শতক"],
    ["son-2", "২১ শতক", "১৪ শতক"],
    ["daughter", "১০.৫ শতক", "৭ শতক"],
  ];
  for (const [key, d210, d211] of expected) {
    await expect(page.getByTestId(`dec-${key}-210`)).toHaveText(d210);
    await expect(page.getByTestId(`dec-${key}-211`)).toHaveText(d211);
  }
  await expect(page.getByTestId("frac-wife")).toHaveText("১/৮");
  await expect(page.getByTestId("frac-daughter")).toHaveText("৭/৪০");
  // Named heirs and the women's-share card.
  await expect(result).toContainText("নাসরিন (মেয়ে)");
  await expect(page.getByLabel("নারীর অংশ")).toContainText("রোকেয়া বেগম (স্ত্রী): ১/৮ (১২.৫%)");

  // The checklist appears only after every heir confirms with the (mock) OTP.
  await expect(page.getByTestId("bontonnama-checklist")).toHaveCount(0);
  for (const [key] of expected) {
    const row = page.locator(`[data-consent="${key}"]`);
    await row.getByRole("button", { name: "ওটিপি পাঠান" }).click();
    const code = await page.getByTestId(`otp-${key}`).textContent();
    await row.getByRole("textbox").fill(code!);
    await row.getByRole("button", { name: "নিশ্চিত করুন" }).click();
    await expect(row).toContainText("সম্মতি দিয়েছেন");
  }
  const checklist = page.getByTestId("bontonnama-checklist");
  await expect(checklist).toContainText("বণ্টননামা");
  await expect(checklist).toContainText("ধারা ১৪৩খ");
  await expect(checklist).toContainText("১,১৭০ টাকা");
});

test("a wrong OTP is not accepted", async ({ page }) => {
  await page.goto("/warish");
  await page.getByRole("button", { name: "উদাহরণ: আব্দুল করিমের পরিবার" }).click();
  await page.getByRole("button", { name: "হিসাব করুন" }).click();
  const row = page.locator('[data-consent="wife"]');
  await row.getByRole("button", { name: "ওটিপি পাঠান" }).click();
  await row.getByRole("textbox").fill("000000");
  await row.getByRole("button", { name: "নিশ্চিত করুন" }).click();
  await expect(row).toContainText("কোড মেলেনি");
});

test("MFLO s.4 on the page: a predeceased son's children inherit his share", async ({ page }) => {
  await page.goto("/warish");
  await page.getByLabel("মৃত ব্যক্তি ও তাঁর জমি").selectOption("manual");
  await page.getByRole("button", { name: "ছেলে বাড়ান" }).click();
  await page.getByRole("button", { name: "+ আগে মারা যাওয়া সন্তান যোগ করুন" }).click();
  await page.getByRole("button", { name: "তাঁর মেয়ে ১ বাড়ান" }).click();
  await page.getByRole("button", { name: "হিসাব করুন" }).click();
  // 100 dec: son 50; predeceased son's son 33.3333, daughter 16.6667
  await expect(page.getByTestId("dec-son-0")).toHaveText("৫০ শতক");
  await expect(page.getByTestId("frac-pson-1-son")).toHaveText("১/৩");
  await expect(page.getByTestId("frac-pson-1-daughter")).toHaveText("১/৬");
  await expect(page.getByTestId("warish-result")).toContainText("ধারা ৪");
});

test("usable at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/warish");
  await page.getByRole("button", { name: "উদাহরণ: আব্দুল করিমের পরিবার" }).click();
  await page.getByRole("button", { name: "হিসাব করুন" }).click();
  await expect(page.getByTestId("dec-daughter-210")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); // prettier-ignore
  expect(overflow).toBeLessThanOrEqual(0);
});
