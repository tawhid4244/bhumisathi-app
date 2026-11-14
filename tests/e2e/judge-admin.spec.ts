import { expect, test } from "@playwright/test";
import { AUTH, SIGNED_OUT } from "./auth-files";

// Task 18: judge mode (no account needed) and the office/admin view.

test.describe("judge mode", () => {
  test.use({ storageState: SIGNED_OUT });

  test("home → Judge mode walks G1 → G3 → G8 → G2 → G7 with Bangla captions", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await page.getByRole("link", { name: /জাজ মোড/ }).click();
    await expect(page).toHaveURL(/\/judge$/);
    await page.getByRole("button", { name: "জাজ মোড শুরু করুন" }).click();

    const card = page.getByTestId("judge-card");
    const expected = [
      ["শুরু", ""],
      ["G1", "green"],
      ["G1", "red"],
      ["G1", "green"],
      ["G3", "amber"],
      ["G8", "red"],
      ["G2", "green"],
      ["G7", "green"],
      ["G7", "amber"],
    ];
    for (const [i, [scenario, verdict]] of expected.entries()) {
      await expect(card).toHaveAttribute("data-scenario", scenario!);
      await expect(card).toHaveAttribute("data-verdict", verdict!);
      await expect(page.getByTestId("judge-caption")).not.toBeEmpty();
      if (i < expected.length - 1) await page.getByRole("button", { name: "পরের ধাপ" }).click();
    }
    await expect(page.getByTestId("judge-done")).toContainText("এক জমি, এক সত্য");
  });

  test("the judge step API only accepts the scripted step numbers", async ({ request }) => {
    expect((await request.post("/api/judge/step", { data: { step: 42 } })).status()).toBe(400);
    expect((await request.post("/api/judge/step", { data: { step: "drop table" } })).status()).toBe(
      400,
    );
  });
});

test("an officer sees the office view without the admin section", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByTestId("office-tiles")).toBeVisible();
  await expect(page.getByTestId("chain-status")).toHaveAttribute("data-ok", "true");
  await expect(page.getByTestId("accounts")).toHaveCount(0);
});

test.describe("admin", () => {
  test.use({ storageState: AUTH.admin });
  test("sees accounts (no passwords) and can reset the demo", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByTestId("accounts")).toContainText("officer@demo.bhumisathi.test");
    await page.getByRole("button", { name: "ডেমো রিসেট" }).click();
    await expect(page.getByRole("status")).toContainText("নতুন করে শুরু");
  });
});

test.describe("citizen", () => {
  test.use({ storageState: AUTH.citizen });
  test("cannot open the office view", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("alert")).toContainText("শুধু কর্মকর্তাদের জন্য");
  });
});
