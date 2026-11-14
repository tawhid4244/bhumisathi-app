import { readUpload, UploadError } from "@/lib/adapters/storage";
import { verifyUploadSignature } from "@/lib/adapters/uploads";
import { requireRole } from "@/lib/auth/guard";

// GET /api/uploads/{id}?exp=…&sig=… → the private image, only with a valid, unexpired link made
// for THIS signed-in user, and only if Row Level Security lets this user see the upload.
export async function GET(request: Request, ctx: RouteContext<"/api/uploads/[id]">) {
  const { user, deny } = await requireRole("citizen");
  if (deny) return deny;
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const notFound = () =>
    Response.json({ error: { bn: "ছবিটি পাওয়া যায়নি বা লিংকের মেয়াদ শেষ।", en: "Not found or link expired." } }, { status: 404 }); // prettier-ignore
  if (!verifyUploadSignature(user, id, url.searchParams.get("exp"), url.searchParams.get("sig"))) {
    return notFound();
  }
  try {
    const { buf, mime } = await readUpload(id, { user }); // RLS: owner or officer only
    return new Response(new Uint8Array(buf), {
      headers: {
        "content-type": mime,
        "cache-control": "private, no-store",
        "content-disposition": "inline",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (err) {
    if (err instanceof UploadError) return notFound();
    throw err;
  }
}
