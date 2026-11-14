import { randomBytes } from "node:crypto";
import { withUser } from "../auth/db";
import type { SessionUser } from "../auth/roles";
import { getSql } from "../sql";
import type { ToolContext } from "../tools/types";

// Private storage for uploaded deed images, kept IN the database (`uploads.data`), so it works
// the same on one laptop and on many serverless instances, and the same Row Level Security rule
// protects the bytes and the row: a citizen can only ever read their own upload.
// Nothing is ever stored under public/ and there is no public URL (see signedUploadUrl).

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ID = /^[a-f0-9]{24}$/;

/** Detect the real file type from its first bytes (never trust the file name or browser). */
export function sniffImage(buf: Buffer): "image/png" | "image/jpeg" | "image/webp" | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png"; // prettier-ignore
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp"; // prettier-ignore
  return null;
}

export class UploadError extends Error {}

/**
 * Store an image. With an owner, the row is written AS that user (RLS insert policy: you can only
 * create uploads in your own name). Without one it is a system upload (demo sample, judge mode),
 * which only officers and trusted server code can read.
 */
export async function saveUpload(
  buf: Buffer,
  owner: SessionUser | null = null,
): Promise<{ id: string; mime: string }> {
  if (buf.length === 0 || buf.length > MAX_UPLOAD_BYTES)
    throw new UploadError("File must be between 1 byte and 5 MB.");
  const mime = sniffImage(buf);
  if (!mime) throw new UploadError("Only PNG, JPEG or WebP images are accepted.");
  const id = randomBytes(12).toString("hex");
  if (owner) {
    await withUser(
      owner,
      (tx) => tx`insert into uploads (id, owner_user_id, mime, size_bytes, data)
                 values (${id}, ${owner.id}, ${mime}, ${buf.length}, ${buf})`,
    );
  } else {
    await getSql()`insert into uploads (id, owner_user_id, mime, size_bytes, data)
                   values (${id}, null, ${mime}, ${buf.length}, ${buf})`;
  }
  return { id, mime };
}

/** Read an image as this caller. RLS decides; anyone else gets "not found" (never "forbidden"). */
export async function readUpload(
  id: string,
  ctx: ToolContext,
): Promise<{ buf: Buffer; mime: string }> {
  // The id format check also blocks path tricks like "../.env.local".
  if (!ID.test(id)) throw new UploadError("Invalid upload id.");
  type Row = { data: Buffer; mime: string };
  let rows: Row[];
  if (ctx.system) {
    rows = await getSql()<Row[]>`select data, mime from uploads where id = ${id}`;
  } else if (ctx.user) {
    const user = ctx.user;
    rows = await withUser(user, (tx) => tx<Row[]>`select data, mime from uploads where id = ${id}`);
  } else {
    rows = [];
  }
  const row = rows[0];
  if (!row) throw new UploadError("Upload not found.");
  return { buf: Buffer.from(row.data), mime: sniffImage(Buffer.from(row.data)) ?? row.mime };
}
