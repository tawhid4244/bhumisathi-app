import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Password hashing with scrypt (OWASP Password Storage Cheat Sheet: N=2^17, r=8, p=1).
// Stored as "scrypt$N$r$p$salt$hash" so the cost can be raised later without breaking old hashes.

const scrypt = promisify(scryptCb) as (
  pw: string,
  salt: Buffer,
  len: number,
  opts: object,
) => Promise<Buffer>;
const N = 2 ** 17;
const R = 8;
const P = 1;
const LEN = 32;
const opts = (n: number, r: number, p: number) => ({ N: n, r, p, maxmem: 256 * n * r });

export const MIN_PASSWORD_LENGTH = 12;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, LEN, opts(N, R, P));
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(
    password,
    Buffer.from(salt, "base64"),
    expected.length,
    opts(Number(n), Number(r), Number(p)),
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A hash of a random password, so "unknown email" takes as long as "wrong password". */
let dummy: Promise<string> | undefined;
export const dummyHash = () => (dummy ??= hashPassword(randomBytes(24).toString("base64")));
