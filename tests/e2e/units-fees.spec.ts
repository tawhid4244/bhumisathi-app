import { expect, test } from "@playwright/test";

test("units: '২ কানি ৫ গন্ডা' shows 270 / 90 / 67.5 decimals side by side with sources", async ({
  page,
}) => {
  await page.goto("/units");
  await page.getByRole("button", { name: "উদাহরণ: ২ কানি ৫ গন্ডা" }).click();
  const result = page.getByTestId("unit-result");
  await expect(page.getByTestId("dec-120")).toHaveText("২৭০ শতক");
  await expect(page.getByTestId("dec-40")).toHaveText("৯০ শতক");
  await expect(page.getByTestId("dec-30")).toHaveText("৬৭.৫ শতক");
  await expect(result.locator('[data-kani="40"]')).toContainText("৩৯,২০৪ বর্গফুট");
  await expect(result).toContainText("কানির মাপ এলাকাভেদে ভিন্ন");
  await expect(result).toContainText("Banglapedia");
});

test("units: a local kani size gives a single answer", async ({ page }) => {
  await page.goto("/units");
  await page.getByRole("textbox", { name: "পরিমাণ ১" }).fill("১");
  await page.getByLabel("একক ১").selectOption("kani");
  await page.getByRole("radio", { name: "৪০ শতক" }).check();
  await page.getByRole("button", { name: "রূপান্তর করুন" }).click();
  await expect(page.getByTestId("dec-40")).toHaveText("৪০ শতক");
  await expect(page.locator("[data-kani]")).toHaveCount(1);
});

test("units: 1 bigha = 33.06 decimals, 20 katha", async ({ page }) => {
  await page.goto("/units");
  await page.getByRole("textbox", { name: "পরিমাণ ১" }).fill("1");
  await page.getByLabel("একক ১").selectOption("bigha");
  await page.getByRole("button", { name: "রূপান্তর করুন" }).click();
  await expect(page.getByTestId("dec-none")).toHaveText("৩৩.০৬ শতক");
  await expect(page.getByTestId("unit-result")).toContainText("২০ কাঠা");
});

test("fees: mutation total Tk 1,170 with source; registration lists no invented rates", async ({
  page,
}) => {
  await page.goto("/fees");
  await expect(page.getByTestId("total-mutation")).toHaveText("১,১৭০ টাকা");
  const mutation = page.locator('[data-service="mutation"]');
  await expect(mutation).toContainText("কোর্ট ফি");
  await expect(mutation).toContainText("সূত্র:");
  const reg = page.locator('[data-service="registration"]');
  await expect(reg).toContainText("স্ট্যাম্প শুল্ক");
  await expect(reg.getByText(/মোট/)).toHaveCount(0);
});

test("units and fees fit a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  for (const path of ["/units", "/fees"]) {
    await page.goto(path);
    if (path === "/units")
      await page.getByRole("button", { name: "উদাহরণ: ২ কানি ৫ গন্ডা" }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); // prettier-ignore
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
