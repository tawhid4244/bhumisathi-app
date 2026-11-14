// The session cookie's name (kept apart from session.ts so proxy.ts does not import the database).
// Production uses the __Host- prefix: the browser then requires Secure, Path=/ and no Domain.
export const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-bs_session" : "bs_session";
