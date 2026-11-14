import { readFile } from "node:fs/promises";
import path from "node:path";
import { signedUploadUrl, storeUpload } from "@/lib/adapters/uploads";
import { rateLimit, requireRole } from "@/lib/auth/guard";
import { LIMITS } from "@/lib/security/rate-limit";

// The synthetic sample deed (content/deeds/deed-4512.png) for the demo:
// GET → the image (public: it is synthetic and watermarked);
// POST → store a copy as THIS user's upload and return its id (signed-in citizens only).
const SAMPLE = () => readFile(path.join(process.cwd(), "content/deeds/deed-4512.png"));

export async function GET() {
  return new Response(new Uint8Array(await SAMPLE()), {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=3600" },
  });
}

export async function POST() {
  const { user, deny } = await requireRole("citizen");
  if (deny) return deny;
  const limited = await rateLimit(`upload:${user.id}`, LIMITS.upload.perMinute, 60);
  if (limited) return limited;
  const { id } = await storeUpload(user, await SAMPLE());
  return Response.json({ upload_id: id, url: signedUploadUrl(user, id) });
}
