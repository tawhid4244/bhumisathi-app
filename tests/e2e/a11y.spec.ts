import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Task 18 accessibility pass: every page, at phone width (mobile project) and desktop.
// - no serious or critical WCAG 2.1 A/AA problems found by axe
// - no horizontal scrolling
// - keyboard focus is visible
const PAGES = [
  "/",
  "/check",
  "/check?mouza=Nayapara&by=dag&no=145",
  "/chat",
  "/deed",
  "/map",
  "/map?dag=145",
  "/warish",
  "/warish?owner=5",
  "/units",
  "/fees",
  "/registry",
  "/verify",
  "/my-land",
  "/admin",
  "/judge",
  "/login",
  "/no-such-page",
];

for (const path of PAGES) {
  test(`${path}: no serious accessibility problems, no sideways scroll`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const bad = violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`); // prettier-ignore
    expect(bad, bad.join("\n")).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("keyboard focus is visible on the first link", async ({ page }) => {
  await page.goto("/check");
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const s = getComputedStyle(el);
    return { tag: el.tagName, width: s.outlineWidth, style: s.outlineStyle };
  });
  expect(outline.style).not.toBe("none");
  expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
});
