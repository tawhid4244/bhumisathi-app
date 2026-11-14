import { expect, test as setup } from "@playwright/test";
import { AUTH } from "./auth-files";

// Log in once per demo role through the real login API and keep the session cookie.
const EMAIL: Record<keyof typeof AUTH, string> = {
  citizen: "citizen@demo.bhumisathi.test",
  citizen2: "citizen2@demo.bhumisathi.test",
  officer: "officer@demo.bhumisathi.test",
  admin: "admin@demo.bhumisathi.test",
};

for (const role of Object.keys(AUTH) as (keyof typeof AUTH)[]) {
  setup(`sign in as ${role}`, async ({ request }) => {
    const password = process.env.DEMO_USER_PASSWORD;
    expect(password, "DEMO_USER_PASSWORD missing: run npm run users").toBeTruthy();
    const res = await request.post("/api/auth/login", { data: { email: EMAIL[role], password } });
    expect(res.status()).toBe(200);
    await request.storageState({ path: AUTH[role] });
  });
}
