import { expect, test } from "@playwright/test";
import { resetDemo, tool } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
});

test("one /chat conversation: G1 check, G3 deed photo, G8 map", async ({ page, request }) => {
  // G1 state first: baina, then a blocked oversell on dag 145.
  await tool(request, "register_baina", { mouza: "Nayapara", dag_no: 145, seller_id: 1, buyer_id: 3, area_dec: 10 }); // prettier-ignore
  await tool(request, "register_sale", { mouza: "Nayapara", dag_no: 145, seller_id: 1, buyer_id: 4, area_dec: 15 }); // prettier-ignore

  await page.goto("/chat");
  const last = () => page.locator('[data-role="assistant"]').last();

  await page.getByRole("textbox").fill("১৪৫ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও");
  await page.keyboard.press("Enter");
  await expect(last().locator("[data-chat-verdict]")).toHaveAttribute("data-chat-verdict", "red");

  await page.getByTestId("chat-attach").setInputFiles("content/deeds/deed-4512.png");
  await expect(page.getByText("📎 দলিলের ছবি")).toBeVisible();
  await expect(last().locator('[data-tool="deed_read"]')).toBeVisible();
  await expect(last()).toContainText("আমিন দিয়ে সীমানা যাচাই করুন");

  await page.getByRole("textbox").fill("১৪৫ নম্বর দাগের মাপ কত?");
  await page.keyboard.press("Enter");
  await expect(last().locator('[data-tool="map_area"]')).toBeVisible();
  await expect(last()).toContainText("প্রায় ২০.০৪ শতক");

  await expect(page.locator('[data-role="assistant"]')).toHaveCount(3);
});

test("check report → map, carrying the dag", async ({ page }) => {
  await page.goto("/check?mouza=nayapara&by=dag&no=145");
  await page.getByTestId("next-steps").getByRole("link", { name: "ম্যাপে দেখুন" }).click();
  await expect(page).toHaveURL(/\/map\?mouza=nayapara&dag=145/);
  await expect(page.getByTestId("map-info")).toContainText("নয়াপাড়া দাগ ১৪৫");
});

test("check report of a deceased owner's dag → warish with that land selected", async ({
  page,
}) => {
  await page.goto("/check?mouza=chr&by=dag&no=210");
  await page.getByTestId("next-steps").getByRole("link", { name: "ওয়ারিশ হিসাব" }).click();
  await expect(page).toHaveURL(/\/warish\?owner=5/);
  await expect(page.getByLabel("মৃত ব্যক্তি ও তাঁর জমি")).toHaveValue("5");
});

test("check report → chat with the dag pre-filled (not sent)", async ({ page }) => {
  await page.goto("/check?mouza=nayapara&by=dag&no=146");
  await page.getByTestId("next-steps").getByRole("link", { name: "সাথীকে জিজ্ঞাসা করুন" }).click();
  await expect(page.getByRole("textbox")).toHaveValue(/নয়াপাড়া মৌজার ১৪৬ নম্বর দাগ নিয়ে জানতে চাই/);
  await expect(page.locator('[data-role="assistant"]')).toHaveCount(0);
});

test("a dag without a map shows no map link; Charpara has no map", async ({ page }) => {
  await page.goto("/check?mouza=chr&by=dag&no=210");
  await expect(
    page.getByTestId("next-steps").getByRole("link", { name: "ম্যাপে দেখুন" }),
  ).toHaveCount(0);
});
