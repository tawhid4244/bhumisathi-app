import { expect, test } from "@playwright/test";
import { resetDemo } from "./helpers";

// G3: the synthetic deed 4512/2024 → fields → Bangla summary → AMBER "verify boundary with an amin".
test.beforeEach(async ({ request }) => {
  await resetDemo(request);
});

test("G3: sample deed is read, summarised and cross-checked → amber", async ({ page }) => {
  await page.goto("/deed");
  await page.getByRole("button", { name: /নমুনা দলিল/ }).click();
  const result = page.getByTestId("deed-result");
  await expect(result.locator("[data-deed-verdict]")).toHaveAttribute("data-deed-verdict", "amber");
  await expect(page.getByTestId("deed-summary")).toContainText("৪৫১২/২০২৪");
  await expect(page.getByTestId("deed-summary")).toContainText("১৪৩ নম্বর দাগের ৮ শতক");
  await expect(result.locator('[data-code="MAP_MISMATCH"]')).toContainText(
    "আমিন দিয়ে সীমানা যাচাই করুন",
  );
  await expect(page.getByRole("img", { name: "আপলোড করা দলিলের ছবি" })).toBeVisible();
  await page.getByRole("link", { name: /দাগ ১৪৩-এর পূর্ণ জমি যাচাই রিপোর্ট/ }).click();
  await expect(page.locator("[data-verdict]")).toHaveAttribute("data-verdict", "amber");
});

test("uploading a non-image file is refused with a clear message", async ({ page }) => {
  await page.goto("/deed");
  await page.locator('input[type="file"]').setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<script>alert(1)</script>") }); // prettier-ignore
  await expect(page.getByText("ছবিটি নেওয়া যায়নি")).toBeVisible();
});

test("uploading the deed photo itself works the same as the sample", async ({ page }) => {
  await page.goto("/deed");
  await page.locator('input[type="file"]').setInputFiles("content/deeds/deed-4512.png");
  await expect(page.locator("[data-deed-verdict]")).toHaveAttribute("data-deed-verdict", "amber");
});
