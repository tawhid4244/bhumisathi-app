import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "./lib/auth/session-cookie";

// Runs before API requests and the signed-in pages.
//
// 1. CSRF defence in depth (the session cookie is already SameSite=Lax): a state-changing API
//    request that the browser marks as coming from another site is refused. Browsers always send
//    Origin / Sec-Fetch-Site on cross-site fetches and form posts; non-browser clients cannot
//    carry a citizen's cookie, so a missing header is allowed.
// 2. Visitors without a session cookie who open a signed-in page get a plain redirect to /login.
//    This is only a shortcut: the page itself still checks the session and the role.

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
const SIGNED_IN_PAGES = ["/chat", "/deed", "/registry"];

export function proxy(request: NextRequest) {
  const { pathname, search, origin } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (SAFE.has(request.method)) return NextResponse.next();
    const site = request.headers.get("sec-fetch-site");
    const from = request.headers.get("origin");
    if (site === "cross-site" || (from !== null && from !== origin)) {
      return NextResponse.json(
        { error: { bn: "অন্য সাইট থেকে আসা অনুরোধ গ্রহণ করা হয় না।", en: "Cross-site request refused." } }, // prettier-ignore
        { status: 403 },
      );
    }
    return NextResponse.next();
  }

  if (SIGNED_IN_PAGES.includes(pathname) && !request.cookies.has(SESSION_COOKIE)) {
    const login = new URL("/login", origin);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*", "/chat", "/deed", "/registry"] };
