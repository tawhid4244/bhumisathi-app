import { expect, test } from "@playwright/test";
import { resetDemo, tool } from "./helpers";

// /chat with the mock model (AI_PROVIDER=mock): real tools, real ledger, scripted model.
test.beforeEach(async ({ request }) => {
  await resetDemo(request);
});

const lastAnswer = (page: import("@playwright/test").Page) =>
  page.locator('[data-role="assistant"]').last();

test("G8 typed: the dag 145 question runs Jomi Check and matches /check", async ({ page }) => {
  await page.goto("/chat");
  await page.getByRole("textbox").fill("১৪৫ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও");
  await page.getByRole("button", { name: "পাঠান" }).click();
  const answer = lastAnswer(page);
  await expect(answer.locator('[data-tool="jomi_check"]')).toHaveText(/জমি যাচাই করা হয়েছে/);
  await expect(answer).toContainText("সবুজ");
  // The verdict chip links to the full report, which shows the same verdict.
  const chip = answer.locator("[data-chat-verdict]");
  await expect(chip).toHaveAttribute("data-chat-verdict", "green");
  await chip.click();
  await expect(page).toHaveURL(/\/check\?mouza=nayapara&by=dag&no=145/);
  await expect(page.locator("[data-verdict]")).toHaveAttribute("data-verdict", "green");
});

test("G6: the mutation question shows Tk 1,170 and a sources list with SAT Act s.143", async ({
  page,
}) => {
  await page.goto("/chat");
  await page.getByRole("button", { name: "নামজারি করতে কী কী লাগবে আর খরচ কত?" }).click();
  const answer = lastAnswer(page);
  await expect(answer.locator('[data-tool="law_search"]')).toBeVisible();
  await expect(answer).toContainText("১,১৭০");
  const sources = answer.getByTestId("sources");
  await expect(sources).toContainText("ধারা ১৪৩");
  await expect(sources).not.toContainText("fee schedule");
  await expect(sources.getByRole("link").first()).toHaveAttribute("href", /^https:\/\//);
});

test("a write needs the citizen's Yes: the confirmation card registers the baina", async ({
  page,
  request,
}) => {
  await page.goto("/chat");
  await page.getByRole("textbox").fill("রহিমের ১৪৫ নম্বর দাগে সালমার নামে ১০ শতক বায়না করুন");
  await page.keyboard.press("Enter");
  const card = page.getByTestId("confirm-card");
  await expect(card).toContainText("বায়না নিবন্ধন");
  await expect(card).toContainText("মোঃ রহিম উদ্দিন → সালমা আক্তার, ১০ শতক");
  // Nothing is written before Yes.
  let status = await tool(request, "ledger_status", { mouza: "Nayapara", dag_no: 145 });
  expect(status.body.active_bainas).toEqual([]);
  // The text box is locked until the card is answered.
  await expect(page.getByRole("textbox")).toBeDisabled();

  await card.getByRole("button", { name: "হ্যাঁ, নিশ্চিত" }).click();
  await expect(lastAnswer(page)).toContainText("B-0021");
  await expect(page.getByTestId("confirm-card")).toHaveCount(0);
  status = await tool(request, "ledger_status", { mouza: "Nayapara", dag_no: 145 });
  expect(status.body.active_bainas[0].id).toBe("B-0021");
});

test("pressing No records nothing", async ({ page, request }) => {
  await page.goto("/chat");
  await page.getByRole("textbox").fill("রহিমের ১৪৫ নম্বর দাগে সালমার নামে ১০ শতক বায়না করুন");
  await page.keyboard.press("Enter");
  await page.getByTestId("confirm-card").getByRole("button", { name: "না, বাতিল" }).click();
  await expect(lastAnswer(page)).toContainText("কিছু নিবন্ধন করা হয়নি");
  const status = await tool(request, "ledger_status", { mouza: "Nayapara", dag_no: 145 });
  expect(status.body.active_bainas).toEqual([]);
});

test("no source → Sathi says it is not sure", async ({ page }) => {
  await page.goto("/chat");
  await page.getByRole("textbox").fill("আজ ঢাকার আবহাওয়া কেমন?");
  await page.keyboard.press("Enter");
  await expect(lastAnswer(page)).toContainText("আমি নিশ্চিত নই");
});

test("English toggle switches the screen language", async ({ page }) => {
  await page.goto("/chat");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  await page.getByRole("button", { name: "Is it safe to buy dag 145 in Nayapara?" }).click();
  await expect(lastAnswer(page).locator('[data-tool="jomi_check"]')).toHaveText(/Land checked/);
});

test("usable at phone width: no horizontal scroll, input visible", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto("/chat");
  await page.getByRole("button", { name: "১৪৫ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও" }).click();
  await expect(lastAnswer(page)).toContainText("সবুজ");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole("textbox")).toBeInViewport();
});
