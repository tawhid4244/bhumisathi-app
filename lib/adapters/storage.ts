import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Private storage for uploaded deed images. Files live in .uploads/ (git-ignored, never under
// public/), named by an unguessable random id. Task 16 swaps this for a private Supabase bucket
// with short-lived signed URLs; callers only use saveUpload / readUpload.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const dir = () => path.join(process.cwd(), ".uploads");
const ID = /^[a-f0-9]{24}$/;

/** Detect the real file type from its first bytes (never trust the file name or browser). */
export function sniffImage(buf: Buffer): "image/png" | "image/jpeg" | "image/webp" | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png"; // prettier-ignore
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp"; // prettier-ignore
  return null;
}

export class UploadError extends Error {}

export async function saveUpload(buf: Buffer): Promise<{ id: string; mime: string }> {
  if (buf.length === 0 || buf.length > MAX_UPLOAD_BYTES)
    throw new UploadError("File must be between 1 byte and 5 MB.");
  const mime = sniffImage(buf);
  if (!mime) throw new UploadError("Only PNG, JPEG or WebP images are accepted.");
  const id = randomBytes(12).toString("hex");
  await mkdir(dir(), { recursive: true });
  await writeFile(path.join(dir(), id), buf);
  return { id, mime };
}

export async function readUpload(id: string): Promise<{ buf: Buffer; mime: string }> {
  // The id format check also blocks path tricks like "../.env.local".
  if (!ID.test(id)) throw new UploadError("Invalid upload id.");
  const buf = await readFile(path.join(dir(), id)).catch(() => null);
  if (!buf) throw new UploadError("Upload not found.");
  return { buf, mime: sniffImage(buf) ?? "application/octet-stream" };
}
