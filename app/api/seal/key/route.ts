import { connection } from "next/server";
import { sealKeys } from "@/lib/engines/seal";

// GET /api/seal/key → BhumiSathi's public seal key, so anyone can check a seal offline
// (Ed25519 over the exact payload bytes; see lib/engines/seal.ts). Never the private key.
export async function GET() {
  await connection();
  try {
    const { kid, pem } = sealKeys();
    return Response.json({ alg: "Ed25519", kid, public_key_pem: pem, format: "BS1.<payload b64url>.<signature b64url>" }); // prettier-ignore
  } catch {
    return Response.json({ error: { bn: "সিলের চাবি সেট করা হয়নি।", en: "Seal key not configured." } }, { status: 503 }); // prettier-ignore
  }
}
