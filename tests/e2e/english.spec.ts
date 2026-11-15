import { expect, test, type Page } from "@playwright/test";
import { resetDemo } from "./helpers";

// English mode: every tool screen shows English, not just the header and home page.
// (Runs as the default officer, so the registry desk and deed reader are open too.)

test.beforeEach(async ({ page, request }) => {
  await resetDemo(request);
  await page.addInitScript(() => localStorage.setItem("bs_lang", "en"));
});

/** Headings in English mode must not contain Bangla script. */
async function headingsAreEnglish(page: Page) {
  // The page first renders in Bangla (server), then switches: wait until every heading has.
  await expect
    .poll(async () =>
      (await page.locator("main h1, main h2, main h3").allInnerTexts()).filter((t) =>
        /[ঀ-৿]/.test(t),
      ),
    ) // prettier-ignore
    .toEqual([]);
}

test("land check report in English", async ({ page }) => {
  await page.goto("/check?mouza=Nayapara&by=dag&no=142");
  await expect(page.locator("[data-verdict]")).toContainText("Red: high risk");
  await expect(page.getByRole("heading", { name: "Reasons", exact: true })).toBeVisible();
  await expect(page.getByText("Court case pending")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Holders and sellable share" })).toBeVisible();
  await headingsAreEnglish(page);
});

test("sub-registry desk in English", async ({ page }) => {
  await page.goto("/registry");
  await page.getByRole("button", { name: "Show ledger" }).click();
  await expect(page.getByTestId("ledger-summary")).toContainText("ledger version");
  await expect(page.getByRole("heading", { name: "2. The transaction" })).toBeVisible();
  await headingsAreEnglish(page);
});

test("inheritance: shares and the working, in English", async ({ page }) => {
  await page.goto("/warish");
  await page.getByRole("button", { name: "Example: Abdul Karim's family" }).click();
  await page.getByRole("button", { name: "Calculate" }).click();
  await expect(page.getByRole("heading", { name: /3\. Everyone's share/ })).toBeVisible();
  await expect(page.getByText("Wife: 1/8 because there are children.")).toBeVisible();
  await expect(page.getByTestId("warish-result")).toContainText("Rokeya Begum (Wife)");
  await headingsAreEnglish(page);
});

test("units and fees in English", async ({ page }) => {
  await page.goto("/units");
  await page.getByRole("button", { name: "Example: 2 kani 5 gonda" }).click();
  await expect(page.getByTestId("unit-result")).toContainText("1 decimal = 435.6 sq ft");
  await expect(page.getByTestId("unit-result")).toContainText("Kani of 120 decimals");
  await page.goto("/fees");
  await expect(page.getByRole("heading", { name: "Mutation (e-namjari)" })).toBeVisible();
  await expect(page.getByTestId("total-mutation")).toHaveText("Tk 1,170");
  await headingsAreEnglish(page);
});

test("mouza map and deed reader in English", async ({ page }) => {
  await page.goto("/map?dag=145");
  await expect(page.getByRole("tab", { name: "Mouza map" })).toBeVisible();
  await expect(page.getByText("Nayapara dag 145")).toBeVisible();
  await page.goto("/deed");
  await page.getByRole("button", { name: "Use the sample deed (4512/2024)" }).click();
  await expect(page.getByTestId("deed-summary")).toContainText("This is a sale (saf kabla) deed");
  await headingsAreEnglish(page);
});

test("verify and judge mode in English", async ({ page }) => {
  await page.goto("/verify");
  await expect(page.getByRole("button", { name: "Verify" })).toBeVisible();
  await page.goto("/judge");
  await expect(page.getByRole("button", { name: "Start judge mode" })).toBeVisible();
  await headingsAreEnglish(page);
});
