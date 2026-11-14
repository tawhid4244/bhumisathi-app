// Roles and what each may do. Least privilege: a citizen checks land and asks questions;
// only officers record bainas, sales and mortgages; only admins reset the demo.

export type Role = "citizen" | "officer" | "admin";
export type Access = "public" | Role;

const RANK: Record<Access, number> = { public: 0, citizen: 1, officer: 2, admin: 3 };

export interface SessionUser {
  id: string;
  email: string;
  name_bn: string;
  role: Role;
  /** The land holder (owners.id) this account stands for, if any: "who checked my land". */
  owner_id?: number | null;
}

/** True when this user (or nobody, for public) may use something that needs `need`. */
export function allowed(user: SessionUser | null, need: Access): boolean {
  return RANK[user?.role ?? "public"] >= RANK[need];
}

export const ROLE_BN: Record<Role, string> = {
  citizen: "নাগরিক",
  officer: "কর্মকর্তা",
  admin: "প্রশাসক",
};
