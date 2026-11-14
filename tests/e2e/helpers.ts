import { expect, request as pw, type APIRequestContext, type Page } from "@playwright/test";
import { AUTH } from "./auth-files";

/** Reset the synthetic world (same as the admin's "Reset demo" button). Always runs as admin. */
export async function resetDemo(request: APIRequestContext) {
  const admin = await pw.newContext({ baseURL: baseUrlOf(request), storageState: AUTH.admin });
  const res = await admin.post("/api/demo/reset");
  expect(res.ok()).toBeTruthy();
  await admin.dispose();
}

/** The base URL a request context was created with (Playwright keeps it private). */
function baseUrlOf(request: APIRequestContext): string {
  const opts = (request as unknown as { _options?: { baseURL?: string } })._options;
  return opts?.baseURL ?? process.env.E2E_BASE_URL ?? "http://localhost:3100";
}

/** Call a registry tool through the public API (as the test's signed-in role). */
export async function tool(request: APIRequestContext, name: string, body: unknown) {
  const res = await request.post(`/api/tools/${name}`, { data: body });
  return { status: res.status(), body: await res.json() };
}

/** Open the /check page for a dag and wait for the verdict. */
export async function openCheck(page: Page, mouza: string, dag: number) {
  await page.goto(`/check?mouza=${mouza}&by=dag&no=${dag}`);
  await expect(page.locator("[data-verdict]")).toBeVisible();
}
