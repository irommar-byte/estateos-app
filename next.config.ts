import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "date-fns",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "recharts",
    ],
  },
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
      /** Alias pod App Store / linki zewnętrzne — treść EN na działającej trasie prawnej. */
      { source: "/privacy-policy", destination: "/polityka-prywatnosci", permanent: false },
      { source: "/privacy-policy/", destination: "/polityka-prywatnosci", permanent: false },
      { source: "/press", destination: "/dla-prasy", permanent: true },
      { source: "/press/", destination: "/dla-prasy", permanent: true },
      { source: "/plan", destination: "/kampania", permanent: false },
      { source: "/register", destination: "/rejestracja", permanent: true },
      { source: "/sprzedaj-za-darmo", destination: "/wystaw-za-darmo", permanent: true },
      { source: "/wystaw-nieruchomosc-za-darmo", destination: "/wystaw-za-darmo", permanent: true },
      { source: "/start", destination: "/wystaw-za-darmo", permanent: false },
    ];
  },
  async rewrites() {
    return [
      /** Android beta — serwuj z API (plik lokalny lub redirect). */
      { source: "/downloads/estateos-android.apk", destination: "/api/downloads/estateos-android" },
      { source: "/downloads/estateos-android.aab", destination: "/api/downloads/estateos-android" },
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
