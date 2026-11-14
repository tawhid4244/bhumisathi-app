import { expect, test } from "@playwright/test";

// Smoke test for task 1: the Bangla home page loads and every journey link opens its page.
const pages = [
  { name: "জমি যাচাই", path: "/check" },
  { name: "সাথী এআই-কে জিজ্ঞাসা করুন", path: "/chat" },
  { name: "ওয়ারিশ হিসাব", path: "/warish" },
  { name: "মৌজা ম্যাপে মাপ", path: "/map" },
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
    await page.getByRole("link", { name: new RegExp(p.name) }).click();
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
