import { expect, test } from "@playwright/test";
import { resetDemo } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
});

test("G8 map: typing dag 145 shows ≈20 decimals in all units, matching the khatian", async ({
  page,
}) => {
  await page.goto("/map");
  await page.getByRole("textbox", { name: "দাগ নম্বর" }).fill("১৪৫");
  await page.getByRole("button", { name: "দেখুন" }).click();
  const info = page.getByTestId("map-info");
  await expect(info).toContainText("নয়াপাড়া দাগ ১৪৫");
  await expect(page.getByTestId("khatian-compare")).toContainText(
    "ম্যাপে ২০.০৪ শতক, খতিয়ানে ২০ শতক — প্রায় মিলেছে",
  );
  await expect(info.locator('[data-unit="কাঠা"]')).toHaveText("১২.১২");
  await expect(info.locator('[data-unit="একর"]')).toHaveText("০.২০০৪");
});

test("tapping khas dag 149 shows the khas flag; dag 143 shows the mismatch", async ({ page }) => {
  await page.goto("/map");
  await page.locator('[data-dag="149"]').click();
  await expect(page.getByTestId("khas-flag")).toBeVisible();
  await page.locator('[data-dag="143"]').click();
  await expect(page.getByTestId("khatian-compare")).toContainText(
    "পার্থক্য ৩.০৪ শতক; আমিন দিয়ে সীমানা যাচাই করুন",
  );
  // keyboard works too
  await page.locator('[data-dag="141"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("map-info")).toContainText("দাগ ১৪১");
});

test("measure on your own map: calibrate 200 ft, mark a square → ≈91.8 decimals", async ({
  page,
}) => {
  // A plain 400 × 400 px picture to measure on.
  await page.setContent('<div style="width:400px;height:400px;background:#eee"></div>');
  const png = await page.locator("div").screenshot();
  await page.goto("/map");
  await page.getByRole("tab", { name: "নিজের ম্যাপে মাপুন" }).click();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "map.png", mimeType: "image/png", buffer: png });
  const surface = page.getByTestId("measure-surface");
  await expect(surface).toBeVisible();
  // Re-measure before every click: typing the distance can scroll the page.
  const at = async (fx: number, fy: number) => {
    await surface.scrollIntoViewIfNeeded();
    const box = (await surface.boundingBox())!;
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  };
  // Scale: two points 0.5 of the width apart = 200 px of the 400 px image → 200 ft.
  await at(0.1, 0.1);
  await at(0.6, 0.1);
  await page.getByLabel("দুই লাল বিন্দুর আসল দূরত্ব").fill("200");
  // Plot: a 200 × 200 px square → 40,000 sq ft ≈ 91.83 decimals.
  await at(0.1, 0.1);
  await at(0.6, 0.1);
  await at(0.6, 0.6);
  await at(0.1, 0.6);
  await page.getByRole("button", { name: /মাপ দেখুন/ }).click();
  const result = page.getByTestId("measure-result");
  await expect(result).toContainText("জরিপ নয়");
  const dec = Number(await result.getAttribute("data-decimals"));
  expect(dec).toBeGreaterThan(89);
  expect(dec).toBeLessThan(95);
});

test("G8 chat: 'মাপ কত?' runs map_area and answers ≈20 decimals", async ({ page }) => {
  await page.goto("/chat");
  await page.getByRole("textbox").fill("১৪৫ নম্বর দাগের মাপ কত?");
  await page.keyboard.press("Enter");
  const answer = page.locator('[data-role="assistant"]').last();
  await expect(answer).toContainText("প্রায় ২০.০৪ শতক");
  await expect(answer).toContainText("মিলেছে");
});

test("map page fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/map");
  await page.locator('[data-dag="145"]').click();
  await expect(page.getByTestId("map-info")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); // prettier-ignore
  expect(overflow).toBeLessThanOrEqual(0);
});
