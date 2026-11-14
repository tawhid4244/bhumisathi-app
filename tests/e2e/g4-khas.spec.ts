import { expect, test } from "@playwright/test";
import { openCheck, resetDemo, tool } from "./helpers";
import { openDag, transact } from "./registry";

// G4: dag 149 is a khas waterbody. Jomi Check → RED; any sale → BLOCKED.
test.beforeEach(async ({ request }) => {
  await resetDemo(request);
});

test("G4 /check: khas dag 149 is red", async ({ page }) => {
  await openCheck(page, "nayapara", 149);
  await expect(page.locator("[data-verdict]")).toHaveAttribute("data-verdict", "red");
  await expect(page.locator('[data-code="KHAS"]')).toContainText("খাস জমি");
});

test("G4 API: a sale of khas land is blocked", async ({ request }) => {
  const r = await tool(request, "register_sale", {
    mouza: "Nayapara",
    dag_no: 149,
    seller_id: 11,
    buyer_id: 4,
    area_dec: 1,
  });
  expect(r.body.ok).toBe(false);
  expect(r.body.reason_bn).toContain("খাস জমি");
});

test("G4 /registry: selling khas dag 149 is blocked at the desk", async ({ page }) => {
  await openDag(page, "nay", 149);
  await transact(page, { action: "বিক্রয় দলিল", counterparty: "জামাল মিয়া", area: "1" });
  await expect(page.locator("[data-result]")).toHaveAttribute("data-result", "blocked");
  await expect(page.locator("[data-result]")).toContainText("খাস জমি");
});
