import { readFile } from "node:fs/promises";
import path from "node:path";
import { saveUpload } from "@/lib/adapters/storage";

// The synthetic sample deed (content/deeds/deed-4512.png) for the demo:
// GET → the image (for the preview); POST → store a copy as an upload and return its id.
const SAMPLE = () => readFile(path.join(process.cwd(), "content/deeds/deed-4512.png"));

export async function GET() {
  return new Response(new Uint8Array(await SAMPLE()), {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=3600" },
  });
}

export async function POST() {
  const { id } = await saveUpload(await SAMPLE());
  return Response.json({ upload_id: id });
}
