import { saveUpload, UploadError } from "@/lib/adapters/storage";

// POST /api/deed/upload (multipart, field "file") → { upload_id }. Private storage only.
// The real file type is checked from its bytes; max 5 MB; PNG/JPEG/WebP.
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new UploadError("No file.");
    const { id } = await saveUpload(Buffer.from(await file.arrayBuffer()));
    return Response.json({ upload_id: id });
  } catch (err) {
    const msg = err instanceof UploadError ? err.message : "Upload failed.";
    return Response.json({ error: { bn: "ছবিটি নেওয়া যায়নি (শুধু PNG/JPEG/WebP, সর্বোচ্চ ৫ MB)।", en: msg } }, { status: 400 }); // prettier-ignore
  }
}
