import { expect, test } from "@playwright/test";
import { openCheck, resetDemo, tool } from "./helpers";

// G1: double sale blocked (dag 145). Steps 1–2 via the API, then the /check page.
const RAHIM = 1;
const SALMA = 3; // Buyer A
const JAMAL = 4; // Buyer B
const dag = { mouza: "Nayapara", dag_no: 145 };

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
});

test("G1 /check: 145 green → amber after baina → red after the blocked oversell", async ({
  page,
  request,
}) => {
  await openCheck(page, "nayapara", 145);
  await expect(page.locator("[data-verdict]")).toHaveAttribute("data-verdict", "green");
  await expect(page.getByTestId("sellable-1")).toHaveText("২০ শতক");

  const s1 = await tool(request, "register_baina", { ...dag, seller_id: RAHIM, buyer_id: SALMA, area_dec: 10 }); // prettier-ignore
  expect(s1.body).toMatchObject({ ok: true, ref: "B-0021" });
  await openCheck(page, "nayapara", 145);
  await expect(page.locator("[data-verdict]")).toHaveAttribute("data-verdict", "amber");
  await expect(page.getByText("বায়না B-0021 দ্বারা")).toBeVisible();

  const s2 = await tool(request, "register_sale", { ...dag, seller_id: RAHIM, buyer_id: JAMAL, area_dec: 15 }); // prettier-ignore
  expect(s2.body.ok).toBe(false);
  await openCheck(page, "nayapara", 145);
  await expect(page.locator("[data-verdict]")).toHaveAttribute("data-verdict", "red");
  await expect(page.getByText("Requested area exceeds sellable balance").first()).toBeVisible();
  await expect(page.getByTestId("sellable-1")).toHaveText("১০ শতক");
});

test("G1 /check: search form works with Bangla digits", async ({ page }) => {
  await page.goto("/check");
  await page.getByRole("textbox", { name: /নম্বর/ }).fill("১৪৫");
  await page.getByRole("button", { name: "যাচাই করুন" }).click();
  await expect(page.locator("[data-verdict]")).toHaveAttribute("data-verdict", "green");
  await expect(page.getByRole("heading", { name: "রেকর্ডের ধারা" })).toBeVisible();
});
