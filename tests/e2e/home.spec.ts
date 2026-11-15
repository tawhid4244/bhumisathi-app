import { expect, test } from "@playwright/test";

// Smoke test for task 1: the Bangla home page loads and every journey link opens its page.
const pages = [
  { name: "জমি যাচাই", path: "/check" },
  { name: "সাথী এআই", path: "/chat" },
  { name: "দলিল পড়ুন", path: "/deed" },
  { name: "মৌজা ম্যাপ", path: "/map" },
  { name: "ওয়ারিশ হিসাব", path: "/warish" },
  { name: "রিপোর্ট যাচাই", path: "/verify" },
  { name: "জমির একক", path: "/units" },
  { name: "সরকারি ফি ও সময়", path: "/fees" },
  { name: "সাব-রেজিস্ট্রি ডেমো", path: "/registry" },
];

test("home page shows the Bangla title and the synthetic-data notice", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ভূমিসাথী — এক জমি, এক সত্য");
  await expect(page.getByText("সব তথ্য কাল্পনিক (সিনথেটিক)")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
});

test("home page has no horizontal scroll at phone width", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

for (const p of pages) {
  test(`link "${p.name}" opens ${p.path}`, async ({ page }) => {
    await page.goto("/");
    await page
      .getByTestId("services")
      .getByRole("link", { name: new RegExp(`^${p.name}`) })
      .click();
    await expect(page).toHaveURL(new RegExp(`${p.path}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}

test("security headers are sent", async ({ request }) => {
  const res = await request.get("/");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  expect(res.headers()["x-powered-by"]).toBeUndefined();
});

test("the language switch shows the site in English and remembers it", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: /^EN$|Switch to English/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "BhumiSathi — one plot, one truth",
  );
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "BhumiSathi — one plot, one truth",
  );
  await page
    .getByRole("button", { name: /^বাং$|বাংলায় দেখুন/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ভূমিসাথী — এক জমি, এক সত্য");
});

test("the ledger demo blocks the second sale", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "১. সালমাকে ১০ শতক বায়না" }).click();
  await page.getByRole("button", { name: "২. জামালের কাছে ১৫ শতক বিক্রি?" }).click();
  await expect(page.getByText(/আটকানো! বিক্রয়যোগ্য মাত্র ১০ শতক/)).toBeVisible();
});

test("quick check in the hero opens the report", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder(/দাগ নং/).fill("১৪১");
  await page.getByRole("button", { name: /^যাচাই/ }).click();
  await expect(page).toHaveURL(/\/check\?mouza=nay&by=dag&no=141/);
  await expect(page.locator("[data-verdict]")).toBeVisible();
});
