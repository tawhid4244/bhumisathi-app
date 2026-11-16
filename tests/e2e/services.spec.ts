import { expect, test } from "@playwright/test";
import { AUTH, SIGNED_OUT } from "./auth-files";

// Phase B — the shared application framework, in the browser:
// citizen applies (wizard) → pays in the sandbox → officer approves in the inbox →
// citizen gets the signed khatian copy with a QR → /verify/doc shows four green lights.

test.describe("land services", () => {
  test.use({ storageState: AUTH.citizen });

  test("apply → pay (sandbox) → officer approves → signed copy verifies green", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/services");
    await expect(page.getByTestId("service-areas").locator("li")).toHaveCount(11);
    await page.getByRole("link", { name: /আবেদন: খতিয়ানের সার্টিফাইড কপি/ }).click();
    await expect(page).toHaveURL(/\/services\/apply\/certified_copy$/);

    // Step 1: land
    const wizard = page.getByTestId("apply-wizard");
    await wizard.getByLabel("মৌজা").selectOption({ label: "নয়াপাড়া (জেএল ৪৫)" });
    await wizard.getByLabel("দাগ নম্বর").fill("১৪৪");
    await wizard.getByText("আরএস", { exact: true }).click();
    await wizard.getByRole("button", { name: "পরের ধাপ →" }).click();
    // Step 2: documents — next stays off until every item is ticked
    const next = wizard.getByRole("button", { name: "পরের ধাপ →" });
    await expect(next).toBeDisabled();
    for (const box of await wizard.getByRole("checkbox").all()) await box.check();
    await next.click();
    // Step 3: fee
    await expect(wizard.getByTestId("fee-total")).toContainText("১০০");
    await wizard.getByRole("button", { name: "আবেদন জমা দিন" }).click();

    await expect(page).toHaveURL(/\/my\/applications\/CPY-\d{4}-\d{4}/);
    const appNo = page.url().match(/CPY-\d{4}-\d{4}/)![0];
    await expect(page.getByTestId("status")).toHaveAttribute("data-status", "payment_due");

    // Sandbox payment
    const pay = page.getByTestId("pay-panel");
    await expect(pay).toContainText("কোনো আসল টাকা কাটা হবে না");
    await pay.getByText("নগদ (পরীক্ষা)").click();
    await pay.getByRole("button", { name: /পরিশোধ করুন \(পরীক্ষা\)/ }).click();
    await expect(page.getByTestId("status")).toHaveAttribute("data-status", "in_review");
    await expect(page.getByTestId("receipt")).toContainText(/রসিদ SBX-[A-Z0-9]{10}/);
    await expect(page.getByTestId("pay-panel")).toHaveCount(0);

    // Public tracker: status only, no names or land details.
    const visitor = await browser.newContext({ storageState: SIGNED_OUT });
    const pub = await visitor.newPage();
    await pub.goto("/track");
    await pub.getByLabel("আবেদন নম্বর").fill(appNo);
    await pub.getByRole("button", { name: "অবস্থা দেখুন" }).click();
    const tracked = pub.getByTestId("track-result");
    await expect(tracked.getByTestId("status")).toHaveAttribute("data-status", "in_review");
    await expect(tracked).not.toContainText("নয়াপাড়া");
    await visitor.close();

    // Officer decides in the inbox.
    const office = await browser.newContext({ storageState: AUTH.officer });
    const officer = await office.newPage();
    await officer.goto("/inbox");
    const row = officer.locator(`[data-app="${appNo}"]`);
    await expect(row).toBeVisible();
    await expect(row.locator("[data-sla]")).toHaveAttribute("data-sla", "green");
    await row.getByRole("button", { name: "মঞ্জুর ও কপি ইস্যু" }).click();
    await expect(officer.locator(`[data-app="${appNo}"]`)).toHaveCount(0);
    await office.close();

    // Citizen: document ready, bell shows it, copy verifies.
    await page.goto(`/my/applications/${appNo}`);
    await expect(page.getByTestId("status")).toHaveAttribute("data-status", "completed");
    const doc = page.getByTestId("issued-document");
    await expect(doc).toContainText("আরএস খতিয়ান নং");
    await expect(doc.locator("svg")).toBeVisible(); // QR
    await expect(page.getByTestId("timeline").locator("[data-action]")).toHaveCount(4);
    await doc.getByRole("link", { name: "এখনই যাচাই করুন" }).click();
    await expect(page).toHaveURL(/\/verify\/doc#BD1\./);
    await expect(page.locator("[data-overall]")).toHaveAttribute("data-overall", "green");
    for (const l of await page.locator("[data-light]").all()) await expect(l).toHaveAttribute("data-ok", "true"); // prettier-ignore

    await page.goto("/my");
    await expect(page.getByTestId("my-apps")).toContainText(appNo);
    await expect(page.getByTestId("notifications")).toContainText(`${appNo}: ডকুমেন্ট প্রস্তুত`);
  });

  test("another citizen cannot open my application", async ({ page, browser }) => {
    await page.goto("/services/apply/certified_copy");
    const wizard = page.getByTestId("apply-wizard");
    await wizard.getByLabel("দাগ নম্বর").fill("144");
    await wizard.getByRole("button", { name: "পরের ধাপ →" }).click();
    for (const box of await wizard.getByRole("checkbox").all()) await box.check();
    await wizard.getByRole("button", { name: "পরের ধাপ →" }).click();
    await wizard.getByRole("button", { name: "আবেদন জমা দিন" }).click();
    await expect(page).toHaveURL(/CPY-\d{4}-\d{4}/);
    const appNo = page.url().match(/CPY-\d{4}-\d{4}/)![0];

    const ctx = await browser.newContext({ storageState: AUTH.citizen2 });
    const other = await ctx.newPage();
    await other.goto(`/my/applications/${appNo}`);
    await expect(other.getByTestId("app-missing")).toBeVisible();
    await ctx.close();

    // Clean up: cancel before paying.
    await page.getByRole("button", { name: "আবেদন বাতিল" }).click();
    await expect(page.getByTestId("status")).toHaveAttribute("data-status", "cancelled");
  });

  test("an unknown dag is refused in plain words", async ({ page }) => {
    await page.goto("/services/apply/certified_copy");
    const wizard = page.getByTestId("apply-wizard");
    await wizard.getByLabel("দাগ নম্বর").fill("9999");
    await wizard.getByRole("button", { name: "পরের ধাপ →" }).click();
    for (const box of await wizard.getByRole("checkbox").all()) await box.check();
    await wizard.getByRole("button", { name: "পরের ধাপ →" }).click();
    await wizard.getByRole("button", { name: "আবেদন জমা দিন" }).click();
    await expect(wizard.getByRole("alert")).toContainText("পাওয়া যায়নি");
  });
});

test.describe("signed out", () => {
  test.use({ storageState: SIGNED_OUT });

  test("My services and the inbox need a sign-in; the catalogue does not", async ({ page }) => {
    await page.goto("/my");
    await expect(page).toHaveURL(/\/login\?next=%2Fmy/);
    await page.goto("/inbox");
    await expect(page).toHaveURL(/\/login\?next=%2Finbox/);
    await page.goto("/services");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("ভূমি সেবাসমূহ");
  });
});

test.describe("office", () => {
  test.use({ storageState: AUTH.citizen });

  test("a citizen cannot open the officer inbox", async ({ page }) => {
    await page.goto("/inbox");
    await expect(page.getByTestId("not-allowed")).toBeVisible();
  });
});
