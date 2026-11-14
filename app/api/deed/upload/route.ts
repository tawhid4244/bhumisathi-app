import { UploadError } from "@/lib/adapters/storage";
import { signedUploadUrl, storeUpload } from "@/lib/adapters/uploads";
import { rateLimit, requireRole } from "@/lib/auth/guard";
import { LIMITS } from "@/lib/security/rate-limit";

// POST /api/deed/upload (multipart, field "file") → { upload_id, url }. Signed-in citizens only.
// Private storage; the upload belongs to this user (RLS). The real file type is checked from its
// bytes; max 5 MB; PNG/JPEG/WebP. `url` is a 5-minute signed link that works only for this user.
export async function POST(request: Request) {
  const { user, deny } = await requireRole("citizen");
  if (deny) return deny;
  const limited = await rateLimit(`upload:${user.id}`, LIMITS.upload.perMinute, 60);
  if (limited) return limited;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new UploadError("No file.");
    const { id } = await storeUpload(user, Buffer.from(await file.arrayBuffer()));
    return Response.json({ upload_id: id, url: signedUploadUrl(user, id) });
  } catch (err) {
    const msg = err instanceof UploadError ? err.message : "Upload failed.";
    if (!(err instanceof UploadError)) console.error("upload failed", err);
    return Response.json({ error: { bn: "ছবিটি নেওয়া যায়নি (শুধু PNG/JPEG/WebP, সর্বোচ্চ ৫ MB)।", en: msg } }, { status: 400 }); // prettier-ignore
  }
}
