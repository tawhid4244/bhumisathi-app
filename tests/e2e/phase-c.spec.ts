import { expect, test, type Page } from "@playwright/test";
import { AUTH } from "./auth-files";
import { openCheck, resetDemo, tool } from "./helpers";

// Phase C golden scenarios in the browser (docs/GOLDEN_SCENARIOS.md):
//   G9  mutation after a sale: apply → fee → hearing → approval → DCR fee → new khatian → the
//       dag's report shows the buyer, and a seal from before turns "superseded"
//   G10 land tax: dag 147 has arrears → dakhila (exempt farmland, Tk 0) → arrears gone
//   G11 complaint by chat: "a broker asked for Tk 5,000" → confirm → number → officer resolves

test.use({ storageState: AUTH.citizen });
test.beforeEach(async ({ request }) => {
  await resetDemo(request);
});

const status = (page: Page) => page.getByTestId("status").first();

test("G9: sale on dag 145 → mutation → hearing → approval → DCR → Jamal holds 10 dec", async ({
  page,
  browser,
}) => {
  test.setTimeout(150_000);
  const office = await browser.newContext({ storageState: AUTH.officer });
  const officer = await office.newPage();

  // A seal taken before the sale, to show it turns "superseded" afterwards.
  const seal = await tool(page.request, "seal_issue", { mouza: "Nayapara", dag_no: 145 });
  expect(seal.status).toBe(200);
  // The sub-registry records the sale (G1 path); a mutation case opens automatically.
  const sale = await tool(office.request, "register_sale", { mouza: "Nayapara", dag_no: 145, seller_id: 1, buyer_id: 4, area_dec: 10 }); // prettier-ignore
  expect(sale.body.ok).toBe(true);

  // Citizen applies with the deed number.
  await page.goto("/services/apply/mutation");
  const form = page.getByTestId("mutation-form");
  await form.getByLabel("নিবন্ধিত বিক্রয় দলিলের নম্বর").fill(sale.body.ref);
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "নামজারির আবেদন জমা দিন" }).click();
  await expect(page).toHaveURL(/\/my\/applications\/MUT-\d{4}-\d{4}/);
  const appNo = page.url().match(/MUT-\d{4}-\d{4}/)![0];
  await expect(page.getByTestId("app-summary")).toContainText("জামাল মিয়া");
  await page
    .getByTestId("pay-panel")
    .getByRole("button", { name: /পরিশোধ করুন/ })
    .click();
  await expect(status(page)).toHaveAttribute("data-status", "in_review");

  // AC Land: hearing, then approval.
  await officer.goto("/inbox");
  const row = officer.locator(`[data-app="${appNo}"]`);
  await row.getByRole("button", { name: "শুনানি ডাকুন (৭ দিন পর)" }).click();
  await expect(row).toContainText("শুনানি");
  await row.getByRole("button", { name: "নামজারি অনুমোদন" }).click();
  await expect(officer.locator(`[data-app="${appNo}"]`)).toHaveCount(0);
  await office.close();

  // Citizen pays the DCR fee; the new khatian is issued.
  await page.reload();
  await expect(status(page)).toHaveAttribute("data-status", "final_payment_due");
  await expect(page.getByTestId("hearing")).toBeVisible();
  const pay = page.getByTestId("pay-panel");
  await expect(pay).toContainText("১১০০"); // DCR: record correction 1,000 + khatian copy 100
  await pay.getByRole("button", { name: /পরিশোধ করুন/ }).click();
  await expect(status(page)).toHaveAttribute("data-status", "completed");
  const doc = page.getByTestId("issued-document");
  await expect(doc).toHaveAttribute("data-kind", "mutation_khatian");
  await expect(doc).toContainText("জামাল মিয়া");

  // The dag's report now lists Jamal with 10 decimals.
  await openCheck(page, "nayapara", 145);
  await expect(page.getByText("জামাল মিয়া").first()).toBeVisible();
  // The seal from before is genuine but superseded.
  await page.goto(`/verify#${seal.body.code}`);
  await expect(page.locator("[data-overall]")).toHaveAttribute("data-overall", "amber");
});

test("G10: dag 147 tax arrears → dakhila → the report no longer flags tax", async ({ page }) => {
  await openCheck(page, "nayapara", 147);
  await expect(page.getByText(/ভূমি উন্নয়ন কর বকেয়া/)).toBeVisible();

  await page.goto("/land-tax");
  await page.getByLabel("দাগ নম্বর").fill("১৪৭");
  await page.getByRole("button", { name: "কর হিসাব করুন" }).click();
  // The demo citizen also sees "tax on my land" above; the lookup result is the last table.
  const report = page.getByTestId("tax-report").last();
  await expect(report.getByTestId("tax-due")).toBeVisible();
  await expect(report).toContainText("করমুক্ত");
  await report.getByRole("button", { name: "দাখিলা নিন (৳০)" }).click();

  await expect(page).toHaveURL(/\/my\/applications\/LDT-\d{4}-\d{4}/);
  await expect(status(page)).toHaveAttribute("data-status", "completed");
  const doc = page.getByTestId("issued-document");
  await expect(doc).toHaveAttribute("data-kind", "dakhila");
  await doc.getByRole("link", { name: "এখনই যাচাই করুন" }).click();
  await expect(page.locator("[data-overall]")).toHaveAttribute("data-overall", "green");

  await openCheck(page, "nayapara", 147);
  await expect(page.getByText(/ভূমি উন্নয়ন কর বকেয়া/)).toHaveCount(0);
});

test("G11: complaint by chat → confirm → number → officer resolves → citizen sees it", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  await page.goto("/chat");
  await page.getByRole("textbox").fill("মিউটেশনে দালাল ৫,০০০ টাকা চেয়েছে");
  await page.getByRole("button", { name: "পাঠান" }).click();
  const card = page.getByTestId("confirm-card");
  await expect(card).toContainText("অভিযোগ দাখিল — দালালের হয়রানি");
  await card.getByRole("button", { name: /হ্যাঁ/ }).click();
  const answer = page.locator('[data-role="assistant"]').last();
  await expect(answer).toContainText(/CMP-\d{4}-\d{4}/);
  const appNo = (await answer.textContent())!.match(/CMP-\d{4}-\d{4}/)![0];

  const office = await browser.newContext({ storageState: AUTH.officer });
  const officer = await office.newPage();
  await officer.goto("/inbox");
  const row = officer.locator(`[data-app="${appNo}"]`);
  await expect(row.getByTestId("urgent")).toBeVisible();
  await row.getByRole("button", { name: "নিষ্পত্তি করুন" }).click();
  await row
    .getByLabel(/কী ব্যবস্থা নেওয়া হয়েছে/)
    .fill("দালালকে সতর্ক করা হয়েছে; আবেদন সরাসরি নেওয়া হয়েছে।");
  await row.getByRole("button", { name: "নিষ্পত্তি নিশ্চিত করুন" }).click();
  await expect(officer.locator(`[data-app="${appNo}"]`)).toHaveCount(0);
  await office.close();

  await page.goto(`/my/applications/${appNo}`);
  await expect(status(page)).toHaveAttribute("data-status", "completed");
  await expect(page.getByTestId("decision-note")).toContainText("দালালকে সতর্ক করা হয়েছে");
  await page.goto("/complaints");
  await expect(page.getByTestId("complaint-stats")).toBeVisible();
});

test("complaint form: anonymous, the office sees no name", async ({ page, browser }) => {
  await page.goto("/fees");
  await page.getByTestId("report-extra").getByRole("link").click();
  const form = page.getByTestId("complaint-form");
  await form.getByRole("textbox").first().fill("ভূমি অফিসে নামজারির জন্য ২০০০ টাকা বেশি চেয়েছে");
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "অভিযোগ জমা দিন" }).click();
  await expect(page).toHaveURL(/CMP-\d{4}-\d{4}/);
  const appNo = page.url().match(/CMP-\d{4}-\d{4}/)![0];
  await expect(page.getByTestId("complaint-text")).toContainText("বেনামি");

  const office = await browser.newContext({ storageState: AUTH.officer });
  const officer = await office.newPage();
  await officer.goto("/inbox");
  const row = officer.locator(`[data-app="${appNo}"]`);
  await expect(row).toContainText("বেনামি");
  await expect(row).not.toContainText("আনোয়ার");
  await office.close();
});
