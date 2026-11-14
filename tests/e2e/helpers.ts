import { expect, type APIRequestContext, type Page } from "@playwright/test";

/** Reset the synthetic world (same as the "Reset demo" button). */
export async function resetDemo(request: APIRequestContext) {
  const res = await request.post("/api/demo/reset");
  expect(res.ok()).toBeTruthy();
}

/** Call a registry tool through the public API. */
export async function tool(request: APIRequestContext, name: string, body: unknown) {
  const res = await request.post(`/api/tools/${name}`, { data: body });
  return { status: res.status(), body: await res.json() };
}

/** Open the /check page for a dag and wait for the verdict. */
export async function openCheck(page: Page, mouza: string, dag: number) {
  await page.goto(`/check?mouza=${mouza}&by=dag&no=${dag}`);
  await expect(page.locator("[data-verdict]")).toBeVisible();
}
