import type { NextConfig } from "next";

/**
 * CSP — Mapbox (mapa), Stripe (płatności), model-viewer (spacer 3D LiDAR).
 * Next.js wymaga 'unsafe-inline' dla stylów i części skryptów hydratacji.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://api.stripe.com https://js.stripe.com wss:",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "worker-src 'self' blob:",
  "media-src 'self' blob: https:",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.estateos.pl" }],
        destination: "https://estateos.pl/:path*",
        permanent: true,
      },
      { source: "/privacy-policy", destination: "/polityka-prywatnosci", permanent: false },
      { source: "/privacy-policy/", destination: "/polityka-prywatnosci", permanent: false },
      { source: "/press", destination: "/dla-prasy", permanent: true },
      { source: "/press/", destination: "/dla-prasy", permanent: true },
      { source: "/plan", destination: "/kampania", permanent: false },
      { source: "/plan/", destination: "/kampania", permanent: false },
    ];
  },
  async rewrites() {
    return [
      { source: "/downloads/estateos-android.apk", destination: "/api/downloads/estateos-android" },
      { source: "/downloads/estateos-android.aab", destination: "/api/downloads/estateos-android" },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
