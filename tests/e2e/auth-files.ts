// Where the e2e setup saves each demo role's session cookies (git-ignored).
export const AUTH = {
  citizen: "tests/e2e/.auth/citizen.json",
  citizen2: "tests/e2e/.auth/citizen2.json",
  officer: "tests/e2e/.auth/officer.json",
  admin: "tests/e2e/.auth/admin.json",
} as const;

export const SIGNED_OUT = { cookies: [], origins: [] };
