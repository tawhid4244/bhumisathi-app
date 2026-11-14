import { expect, request as pw, test, type Page } from "@playwright/test";
import { AUTH, SIGNED_OUT } from "./auth-files";
import { openCheck, resetDemo } from "./helpers";

// G7 — BhumiSeal-lite, plus "who checked my land" (Task 17).
// The demo citizen is Anwar Hossain, holder of dag 141.
test.use({ storageState: AUTH.citizen });

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
});

async function issueOnCheckPage(page: Page): Promise<string> {
  await openCheck(page, "Nayapara", 141);
  await page.getByRole("button", { name: "সিলযুক্ত রিপোর্ট নিন" }).click();
  await expect(page.getByTestId("seal-qr")).toBeVisible();
  return (await page.getByTestId("seal-code").textContent())!.trim();
}

const lights = (page: Page) => page.locator("[data-light]");

test("G7: report for dag 141 → QR → verify → GENUINE + CURRENT (four green lights)", async ({
  page,
}) => {
  await issueOnCheckPage(page);
  await page.getByTestId("seal-verify-link").click();
  await expect(page).toHaveURL(/\/verify#BS1\./);
  await expect(page.locator("[data-overall]")).toHaveAttribute("data-overall", "green");
  await expect(page.getByTestId("seal-overall")).toHaveText("আসল এবং হালনাগাদ");
  await expect(lights(page)).toHaveCount(4);
  for (const l of await lights(page).all()) await expect(l).toHaveAttribute("data-ok", "true");
  await expect(page.getByText(/জে\.এল\. ৪৫\), দাগ ১৪১ — /)).toBeVisible(); // the signed contents
});

test("G7: one digit changed in the payload → NOT GENUINE", async ({ page }) => {
  const code = await issueOnCheckPage(page);
  const [prefix, body, sig] = code.split(".");
  const json = Buffer.from(body!, "base64url").toString("utf8").replace('"dag_no":141', '"dag_no":143'); // prettier-ignore
  const forged = [prefix, Buffer.from(json).toString("base64url"), sig].join(".");

  await page.goto("/verify");
  await page.getByLabel(/রিপোর্টের কোড/).fill(forged);
  await page.getByRole("button", { name: "যাচাই করুন" }).click();
  await expect(page.locator("[data-overall]")).toHaveAttribute("data-overall", "red");
  await expect(page.getByTestId("seal-overall")).toContainText("আসল নয়");
  await expect(page.locator('[data-light="genuine"]')).toHaveAttribute("data-ok", "false");
});

test("G7: an old report after a new baina on the dag → GENUINE but SUPERSEDED (amber)", async ({
  page,
  request,
  baseURL,
}) => {
  const seal = await (await request.post("/api/tools/seal_issue", { data: { mouza: "Nayapara", dag_no: 141 } })).json(); // prettier-ignore
  const officer = await pw.newContext({ baseURL, storageState: AUTH.officer });
  const baina = await officer.post("/api/tools/register_baina", { data: { mouza: "Nayapara", dag_no: 141, seller_id: 20, buyer_id: 3, area_dec: 2 } }); // prettier-ignore
  expect((await baina.json()).ok).toBe(true);
  await officer.dispose();

  await page.goto(`/verify#${seal.code}`);
  await expect(page.locator("[data-overall]")).toHaveAttribute("data-overall", "amber");
  await expect(page.getByTestId("seal-overall")).toContainText("পুরনো");
  await expect(page.locator('[data-light="genuine"]')).toHaveAttribute("data-ok", "true");
  await expect(page.locator('[data-light="current"]')).toHaveAttribute("data-ok", "false");
  await expect(page.locator('[data-light="current"]')).toContainText("১টি নতুন লেনদেন");
});

test("who checked my land: Anwar sees a visitor's check and an officer's ledger view, by role", async ({
  page,
  baseURL,
}) => {
  const visitor = await pw.newContext({ baseURL, storageState: SIGNED_OUT });
  await visitor.post("/api/tools/jomi_check", { data: { mouza: "Nayapara", dag_no: 141 } });
  await visitor.dispose();
  const officer = await pw.newContext({ baseURL, storageState: AUTH.officer });
  await officer.post("/api/tools/ledger_status", { data: { mouza: "Nayapara", dag_no: 141 } });
  await officer.dispose();

  await page.goto("/my-land");
  const list = page.getByTestId("who-checked");
  await expect(list.locator('[data-action="view_ledger"]')).toContainText("সাব-রেজিস্ট্রি কর্মকর্তা");
  await expect(list.locator('[data-action="view_report"]').first()).toContainText("লগইন ছাড়া একজন দর্শক"); // prettier-ignore
  await expect(list).toContainText("দাগ ১৪১");
});

test.describe("officer", () => {
  test.use({ storageState: AUTH.officer });
  test("sees that the audit hash chain is intact", async ({ page }) => {
    await page.goto("/my-land");
    await expect(page.getByTestId("chain-status")).toHaveAttribute("data-ok", "true");
  });
});

test.describe("signed out", () => {
  test.use({ storageState: SIGNED_OUT });
  test("anyone can verify a seal, but getting one needs an account", async ({ page }) => {
    await openCheck(page, "Nayapara", 141);
    await page.getByRole("button", { name: "সিলযুক্ত রিপোর্ট নিন" }).click();
    await expect(page.getByTestId("seal-panel").getByRole("alert")).toContainText("লগইন করুন");
    await page.goto("/verify");
    await expect(page.getByLabel(/রিপোর্টের কোড/)).toBeVisible();
  });
});
