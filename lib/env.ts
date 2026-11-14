import { z } from "zod";

// All configuration comes from environment variables (.env.local locally, Vercel in production).
// Values are validated here once; the rest of the app never reads process.env directly.
// Error messages name the missing variable but never print a value.

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

/** Names of variables that failed validation (never their values). */
function problems(error: z.ZodError): string {
  return error.issues.map((i) => i.path.join(".")).join(", ");
}

export function readPublicEnv(source: Record<string, string | undefined> = process.env): PublicEnv {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: source.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    throw new Error(`Missing or invalid env: ${problems(parsed.error)}. Fill them in .env.local.`);
  }
  return parsed.data;
}

export function readServerEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const parsed = serverSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: source.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: source.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!parsed.success) {
    throw new Error(`Missing or invalid env: ${problems(parsed.error)}. Fill them in .env.local.`);
  }
  return parsed.data;
}

/** True when Supabase keys are present; integration tests use this to skip on a fresh clone. */
export function hasSupabaseEnv(source: Record<string, string | undefined> = process.env): boolean {
  return serverSchema.safeParse(source).success;
}
