import { createHmac, timingSafeEqual } from "node:crypto";
import { withUser } from "../auth/db";
import type { SessionUser } from "../auth/roles";
import { saveUpload, UploadError } from "./storage";

// Who owns each private upload, checked through Row Level Security, plus short-lived signed URLs.
//
// * storeUpload writes the file and an `uploads` row AS the user (role app_user): the RLS insert
//   policy only accepts rows whose owner is the signed-in user.
// * assertCanReadUpload selects the row AS the user: RLS returns it only to its owner or to an
//   officer/admin. Anyone else gets "not found" — we never reveal that the id exists.
// * signedUploadUrl gives a link valid for a few minutes, bound to the file id AND the user, so a
//   copied link is useless to anyone else and soon useless to everyone.

export const SIGNED_URL_SECONDS = 300;

export async function storeUpload(
  user: SessionUser,
  buf: Buffer,
): Promise<{ id: string; mime: string }> {
  const saved = await saveUpload(buf);
  await withUser(
    user,
    (tx) => tx`
    insert into uploads (id, owner_user_id, mime, size_bytes)
    values (${saved.id}, ${user.id}, ${saved.mime}, ${buf.length})`,
  );
  return saved;
}

export async function assertCanReadUpload(user: SessionUser | null, id: string): Promise<void> {
  if (!user) throw new UploadError("Upload not found.");
  const rows = await withUser(user, (tx) => tx`select 1 from uploads where id = ${id}`);
  if (rows.length === 0) throw new UploadError("Upload not found.");
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET is missing or shorter than 32 characters.");
  return s;
}

const mac = (id: string, userId: string, exp: number) =>
  createHmac("sha256", secret()).update(`upload:${id}:${userId}:${exp}`).digest("base64url");

/** A link to view this upload, valid for SIGNED_URL_SECONDS, only for this user. */
export function signedUploadUrl(user: SessionUser, id: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + SIGNED_URL_SECONDS;
  return `/api/uploads/${id}?exp=${exp}&sig=${mac(id, user.id, exp)}`;
}

/** True when the signature matches this id + user and has not expired. */
export function verifyUploadSignature(
  user: SessionUser,
  id: string,
  exp: string | null,
  sig: string | null,
  now = Date.now(),
): boolean {
  const e = Number(exp);
  if (!sig || !Number.isInteger(e) || e < Math.floor(now / 1000)) return false;
  if (e > Math.floor(now / 1000) + SIGNED_URL_SECONDS) return false; // not issued by us
  const a = Buffer.from(sig);
  const b = Buffer.from(mac(id, user.id, e));
  return a.length === b.length && timingSafeEqual(a, b);
}
