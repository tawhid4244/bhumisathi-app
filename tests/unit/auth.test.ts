import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/auth/guard";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { allowed } from "@/lib/auth/roles";
import { signedUploadUrl, SIGNED_URL_SECONDS, verifyUploadSignature } from "@/lib/adapters/uploads";

process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret-1234";

const citizen = { id: "11111111-1111-1111-1111-111111111111", email: "a@x.test", name_bn: "ক", role: "citizen" as const }; // prettier-ignore
const other = { ...citizen, id: "22222222-2222-2222-2222-222222222222" };

describe("passwords (scrypt)", () => {
  it("verifies the right password, rejects a wrong one, and salts every hash", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h).toMatch(/^scrypt\$131072\$8\$1\$/);
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("correct horse batterY", h)).toBe(false);
    expect(await hashPassword("correct horse battery")).not.toBe(h);
  });

  it("refuses short passwords and malformed hashes", async () => {
    await expect(hashPassword("short")).rejects.toThrow();
    expect(await verifyPassword("x", "md5$abc")).toBe(false);
  });
});

describe("roles", () => {
  it("ranks public < citizen < officer < admin", () => {
    expect(allowed(null, "public")).toBe(true);
    expect(allowed(null, "citizen")).toBe(false);
    expect(allowed(citizen, "citizen")).toBe(true);
    expect(allowed(citizen, "officer")).toBe(false);
    expect(allowed({ ...citizen, role: "admin" }, "officer")).toBe(true);
  });
});

describe("safe redirect after login", () => {
  it("allows only our own paths", () => {
    expect(safeNext("/chat?q=1")).toBe("/chat?q=1");
    for (const bad of [
      "//evil.test",
      "https://evil.test",
      String.raw`/\evil.test`,
      "javascript:alert(1)",
      5,
    ]) {
      expect(safeNext(bad)).toBe("/");
    }
  });
});

describe("signed upload links", () => {
  const id = "a".repeat(24);
  const parts = (url: string) => {
    const u = new URL(url, "http://x");
    return [u.searchParams.get("exp"), u.searchParams.get("sig")] as const;
  };

  it("work for the same user and id before they expire", () => {
    const [exp, sig] = parts(signedUploadUrl(citizen, id));
    expect(verifyUploadSignature(citizen, id, exp, sig)).toBe(true);
  });

  it("fail for another user, another file, a changed expiry, or after expiry", () => {
    const now = Date.now();
    const [exp, sig] = parts(signedUploadUrl(citizen, id, now));
    expect(verifyUploadSignature(other, id, exp, sig, now)).toBe(false);
    expect(verifyUploadSignature(citizen, "b".repeat(24), exp, sig, now)).toBe(false);
    expect(verifyUploadSignature(citizen, id, String(Number(exp) + 1), sig, now)).toBe(false);
    expect(verifyUploadSignature(citizen, id, exp, sig, now + (SIGNED_URL_SECONDS + 1) * 1000)).toBe(false); // prettier-ignore
    expect(verifyUploadSignature(citizen, id, exp, null, now)).toBe(false);
  });
});
