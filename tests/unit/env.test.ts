import { describe, expect, it } from "vitest";
import { hasSupabaseEnv, readServerEnv } from "@/lib/env";

const secret = "super-secret-service-role-key-value-123";

describe("env validation", () => {
  it("names the missing variables", () => {
    expect(() => readServerEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("never puts a secret value into the error message", () => {
    try {
      readServerEnv({
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "short",
        SUPABASE_SERVICE_ROLE_KEY: secret,
      });
      expect.unreachable();
    } catch (e) {
      expect(String(e)).not.toContain(secret);
      expect(String(e)).not.toContain("not-a-url");
    }
  });

  it("accepts a complete configuration", () => {
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-anon-key-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: secret,
    };
    expect(hasSupabaseEnv(env)).toBe(true);
    expect(readServerEnv(env).NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
  });
});
