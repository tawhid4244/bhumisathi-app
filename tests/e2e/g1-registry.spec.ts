import { expect, test } from "@playwright/test";
import { AUTH } from "./auth-files";
import { resetDemo } from "./helpers";
import { openDag, transact } from "./registry";

// G1 end to end on the sub-registry screen: baina → oversell blocked → sale OK.
test.beforeEach(async ({ request }) => {
  await resetDemo(request);
});

test("G1 /registry: double sale of dag 145 is blocked, SMS and mutation case appear", async ({
  page,
}) => {
  await openDag(page, "nay", 145);
  await expect(page.getByTestId("desk-sellable-1")).toHaveText("২০ শতক");

  // Step 1: baina B-0021 to Buyer A (Salma), 10 dec → registered; SMS to Rahim and Salma.
  await transact(page, { action: "বায়না", counterparty: "সালমা আক্তার", area: "10" });
  await expect(page.locator("[data-result]")).toHaveAttribute("data-result", "ok");
  await expect(page.locator("[data-result]")).toContainText("B-0021");
  await expect(page.getByTestId("sms-log").locator("li")).toHaveCount(2);
  await expect(page.getByTestId("desk-sellable-1")).toHaveText("১০ শতক");

  // Step 2: sale of 15 dec to Buyer B (Jamal): the check shows RED, and the ledger blocks it.
  await page.getByRole("radio", { name: "বিক্রয় দলিল" }).check();
  await page.getByRole("combobox", { name: /^ক্রেতা/ }).selectOption({ label: "জামাল মিয়া" });
  await page.getByLabel("জমির পরিমাণ (শতক)").fill("15");
  await page.getByRole("button", { name: "জমি যাচাই করুন" }).click();
  await expect(page.locator("[data-desk-verdict]")).toHaveAttribute("data-desk-verdict", "red");
  await expect(page.getByTestId("readback")).toContainText("১৫ শতক");
  await page.getByRole("button", { name: "হ্যাঁ, নিবন্ধন করুন" }).click();
  await expect(page.locator("[data-result]")).toHaveAttribute("data-result", "blocked");
  await expect(page.locator("[data-result]")).toContainText("বিক্রয়যোগ্য মাত্র ১০ শতক");
  await expect(page.locator("[data-result]")).toContainText("B-0021");
  // Buyer A is warned by SMS.
  await expect(page.getByTestId("sms-log").locator("li").first()).toContainText("সালমা আক্তার");
  await expect(page.getByTestId("sms-log").locator("li").first()).toContainText("আটকানো হয়েছে");

  // Step 3: sale of 10 dec to Buyer B → registered, mutation case pending with a 28-day deadline.
  await transact(page, { action: "বিক্রয় দলিল", counterparty: "জামাল মিয়া", area: "10" });
  await expect(page.locator("[data-result]")).toHaveAttribute("data-result", "ok");
  await expect(page.locator("[data-result]")).toContainText("নামজারি মামলা");
  await expect(page.getByTestId("mutation-list")).toContainText("জামাল মিয়া");
  await expect(page.getByTestId("desk-sellable-1")).toHaveText("০ শতক");
});

test.describe("as the demo admin", () => {
  test.use({ storageState: AUTH.admin }); // only admins see the Reset button

  test("Reset demo puts dag 145 back to 20 sellable", async ({ page }) => {
    await openDag(page, "nay", 145);
    await transact(page, { action: "বায়না", counterparty: "সালমা আক্তার", area: "10" });
    await page.getByRole("button", { name: "ডেমো রিসেট" }).click();
    await expect(page.getByTestId("sms-log")).toContainText("এখনও কোনো বার্তা নেই");
    await openDag(page, "nay", 145);
    await expect(page.getByTestId("desk-sellable-1")).toHaveText("২০ শতক");
  });
});
