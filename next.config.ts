import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Kanoniczny URL oferty: `/o/:id` → `src/app/o/[id]`. Legacy HTML: `public/offer-landing.html` (bez rewrite). */
  images: {
    /** `next/image` — jawne hosty prod/dev; uploady w katalogu WWW używają zwykłego `<img>`. */
    remotePatterns: [
      { protocol: "https", hostname: "estateos.pl", pathname: "/**" },
      { protocol: "https", hostname: "www.estateos.pl", pathname: "/**" },
      { protocol: "http", hostname: "localhost", pathname: "/**" },
      { protocol: "http", hostname: "127.0.0.1", pathname: "/**" },
    ],
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
