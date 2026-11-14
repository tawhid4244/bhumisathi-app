import { expect, type Page } from "@playwright/test";

// Drives the /registry desk like a sub-registrar would.

export async function openDag(page: Page, mouzaCode: string, dag: number) {
  await page.goto("/registry");
  await page.getByLabel("মৌজা").selectOption(mouzaCode);
  await page.getByLabel("দাগ নম্বর").fill(String(dag));
  await page.getByRole("button", { name: "লেজার দেখুন" }).click();
  await expect(page.getByTestId("ledger-summary")).toBeVisible();
}

export async function transact(
  page: Page,
  opts: {
    action: "বিক্রয় দলিল" | "বায়না" | "বন্ধক";
    seller?: string;
    counterparty: string;
    area: string;
  },
) {
  await page.getByRole("radio", { name: opts.action }).check();
  if (opts.seller) {
    await page.getByLabel(/বিক্রেতা|জমির মালিক/).selectOption({ label: opts.seller });
  }
  await page.getByRole("combobox", { name: /^(ক্রেতা|ব্যাংক)/ }).selectOption({ label: opts.counterparty });
  await page.getByLabel("জমির পরিমাণ (শতক)").fill(opts.area);
  await page.getByRole("button", { name: "জমি যাচাই করুন" }).click();
  await expect(page.getByTestId("readback")).toBeVisible();
  await page.getByRole("button", { name: "হ্যাঁ, নিবন্ধন করুন" }).click();
  await expect(page.locator("[data-result]")).toBeVisible();
}
