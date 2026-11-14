import type { NextConfig } from "next";

// Security headers sent on every response. A strict nonce-based script CSP needs per-request
// rendering, so it is added with auth in task 16; these headers are safe for every page today.
const securityHeaders = [
  // Only ever talk to this site over HTTPS (2 years, include subdomains).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // No other site may frame BhumiSathi (stops clickjacking on the registry screen).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Microphone is allowed for our own pages only (push-to-talk); camera for deed photos.
  {
    key: "Permissions-Policy",
    value: "microphone=(self), camera=(self), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // The law library is read from disk at runtime (lib/ai/laws.ts): ship it with the server code.
  outputFileTracingIncludes: {
    "/api/**": ["./content/laws/**", "./content/qa.json"],
    "/chat": ["./content/laws/**", "./content/qa.json"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
