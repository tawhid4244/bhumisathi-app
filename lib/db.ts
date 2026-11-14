import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readPublicEnv, readServerEnv } from "./env";

// Two Supabase clients:
// - publicClient: anon key, obeys Row Level Security. Safe for anything a citizen may see.
// - serviceClient: service-role key, BYPASSES Row Level Security. Server code only
//   (API routes, seed script, tests). It must never be imported into a client component.

let publicClient: SupabaseClient | undefined;
let serviceClient: SupabaseClient | undefined;

export function getPublicClient(): SupabaseClient {
  if (!publicClient) {
    const env = readPublicEnv();
    publicClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  }
  return publicClient;
}

export function getServiceClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("getServiceClient() must only run on the server.");
  }
  if (!serviceClient) {
    const env = readServerEnv();
    serviceClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serviceClient;
}
