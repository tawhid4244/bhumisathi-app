import { expect, test } from "@playwright/test";
import { openCheck, resetDemo, tool } from "./helpers";
import { openDag, transact } from "./registry";

// G5: dag 146 mortgaged to Demo Bank (5 dec); dag 142 has pending civil suit 101/2025.
test.beforeEach(async ({ request }) => {
  await resetDemo(request);
});

test("G5 /check: 146 is amber with the Demo Bank mortgage", async ({ page }) => {
  await openCheck(page, "nayapara", 146);
  await expect(page.locator("[data-verdict]")).toHaveAttribute("data-verdict", "amber");
  await expect(page.locator('[data-code="MORTGAGE"]')).toContainText("ডেমো ব্যাংক লিমিটেড");
});

test("G5 /check: 142 is red because a court case is pending", async ({ page }) => {
  await openCheck(page, "nayapara", 142);
  await expect(page.locator("[data-verdict]")).toHaveAttribute("data-verdict", "red");
  await expect(page.locator('[data-code="COURT_CASE"]')).toContainText("১০১/২০২৫");
});

test("G5 API: selling the mortgaged portion is blocked without bank release", async ({
  request,
}) => {
  const r = await tool(request, "register_sale", {
    mouza: "Nayapara",
    dag_no: 146,
    seller_id: 23,
    buyer_id: 4,
    area_dec: 20,
  });
  expect(r.body.ok).toBe(false);
  expect(r.body.reason_en).toContain("mortgaged to Demo Bank Ltd.");
});

test("G5 /registry: 146 mortgaged portion and 142 court case are blocked", async ({ page }) => {
  await openDag(page, "nay", 146);
  await transact(page, { action: "বিক্রয় দলিল", counterparty: "জামাল মিয়া", area: "20" });
  await expect(page.locator("[data-result]")).toHaveAttribute("data-result", "blocked");
  await expect(page.locator("[data-result]")).toContainText("ডেমো ব্যাংক লিমিটেড");

  await openDag(page, "nay", 142);
  await transact(page, { action: "বিক্রয় দলিল", counterparty: "জামাল মিয়া", area: "1" });
  await expect(page.locator("[data-result]")).toHaveAttribute("data-result", "blocked");
  await expect(page.locator("[data-result]")).toContainText("মামলা চলমান");
});
