import type postgres from "postgres";
import { getSql } from "../sql";
import type { SessionUser } from "./roles";

/**
 * Run queries as the restricted role `app_user`, with this user's id and role set for the
 * transaction. Row Level Security then decides what the user may see (e.g. only their uploads).
 */
export async function withUser<T>(
  user: SessionUser | null,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return getSql().begin(async (tx) => {
    await tx`select set_config('app.user_id', ${user?.id ?? ""}, true),
                    set_config('app.user_role', ${user?.role ?? "anon"}, true)`;
    await tx.unsafe("set local role app_user");
    return fn(tx);
  }) as Promise<T>;
}
