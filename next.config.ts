import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  /** Stałe 301: jedna kanoniczna domena (Universal Links / App Links bez duplikatu www). */
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.estateos.pl" }],
        destination: "https://estateos.pl/:path*",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    /** Jednoplikowa wizytówka: URL pozostaje /o/:id (Universal Links / udostępnianie). */
    return [
      { source: "/o/:id(\\d+)", destination: "/offer-landing.html" },
      { source: "/o/:id(\\d+)/", destination: "/offer-landing.html" },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
        ],
      },
    ];
  },
};

export default nextConfig;
