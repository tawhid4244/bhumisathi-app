import { expect, request as pw, test } from "@playwright/test";
import { AUTH, SIGNED_OUT } from "./auth-files";

// Task 16: sign-in, roles, CSRF and private deeds, through the real browser and API.

test.describe("signed out", () => {
  test.use({ storageState: SIGNED_OUT });

  test("Sathi AI asks a visitor to sign in, then brings them back to the chat", async ({
    page,
  }) => {
    await page.goto("/chat");
    await expect(page).toHaveURL(/\/login\?next=%2Fchat/);
    await page.getByLabel(/ইমেইল/).fill("citizen@demo.bhumisathi.test");
    await page.getByLabel(/পাসওয়ার্ড/).fill(process.env.DEMO_USER_PASSWORD!);
    await page.getByRole("button", { name: "লগইন করুন" }).click();
    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByTestId("user-bar")).toContainText("নাগরিক");
  });

  test("a wrong password shows one message that does not reveal whether the email exists", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/ইমেইল/).fill("nobody@demo.bhumisathi.test");
    await page.getByLabel(/পাসওয়ার্ড/).fill("not-the-password-123");
    await page.getByRole("button", { name: "লগইন করুন" }).click();
    await expect(page.locator("#login-error")).toHaveText("ইমেইল বা পাসওয়ার্ড সঠিক নয়।");
  });

  test("public checks work; AI, uploads and ledger writes need an account", async ({ request }) => {
    expect((await request.post("/api/tools/jomi_check", { data: { mouza: "Nayapara", dag_no: 145 } })).status()).toBe(200); // prettier-ignore
    expect((await request.post("/api/agent/stream", { data: { message: "হ্যালো" } })).status()).toBe(401); // prettier-ignore
    expect((await request.post("/api/deed/sample")).status()).toBe(401);
    expect((await request.post("/api/tools/register_sale", { data: {} })).status()).toBe(401);
    expect((await request.post("/api/demo/reset")).status()).toBe(401);
  });

  test("the login page never redirects to another site", async ({ page }) => {
    await page.goto("/login?next=//evil.example");
    await page.getByLabel(/ইমেইল/).fill("citizen@demo.bhumisathi.test");
    await page.getByLabel(/পাসওয়ার্ড/).fill(process.env.DEMO_USER_PASSWORD!);
    await page.getByRole("button", { name: "লগইন করুন" }).click();
    await expect(page.getByTestId("user-bar")).toBeVisible();
    await expect(page).not.toHaveURL(/evil/);
  });
});

test.describe("as a citizen", () => {
  test.use({ storageState: AUTH.citizen });

  test("cannot open the sub-registry desk, record a sale or reset the demo", async ({
    page,
    request,
  }) => {
    await page.goto("/registry");
    await expect(page.getByTestId("not-allowed")).toContainText("শুধু কর্মকর্তাদের জন্য");
    const sale = { mouza: "Nayapara", dag_no: 145, seller_id: 1, buyer_id: 4, area_dec: 1 };
    expect((await request.post("/api/tools/register_sale", { data: sale })).status()).toBe(403);
    expect((await request.post("/api/demo/reset")).status()).toBe(403);
    expect((await request.get("/api/demo/activity")).status()).toBe(403);
  });

  test("another citizen cannot read my deed, even with its id and my signed link", async ({
    request,
    baseURL,
  }) => {
    const mine = await (await request.post("/api/deed/sample")).json();
    expect(mine.upload_id).toMatch(/^[a-f0-9]{24}$/);
    expect((await request.get(mine.url)).status()).toBe(200); // my own short-lived link works

    const other = await pw.newContext({ baseURL, storageState: AUTH.citizen2 });
    const read = await other.post("/api/tools/deed_read", { data: { upload_id: mine.upload_id } });
    expect(read.status()).toBe(404); // "not found": it does not even admit the deed exists
    expect((await other.get(mine.url)).status()).toBe(404);
    await other.dispose();
  });

  test("a request from another website is refused (CSRF)", async ({ request }) => {
    const res = await request.post("/api/deed/sample", {
      headers: { origin: "https://evil.example" },
    });
    expect(res.status()).toBe(403);
  });
});

test("an officer sees the desk but not the admin's reset button", async ({ page }) => {
  await page.goto("/registry");
  await expect(page.getByTestId("user-bar")).toContainText("কর্মকর্তা");
  await expect(page.getByRole("button", { name: "লেজার দেখুন" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ডেমো রিসেট" })).toHaveCount(0);
});
