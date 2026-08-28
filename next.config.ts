import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 3600,
    remotePatterns: [
      { protocol: "https", hostname: "**.estateos.pl" },
      { protocol: "https", hostname: "estateos.pl" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "api.mapbox.com" },
      { protocol: "https", hostname: "**.otodom.pl" },
      { protocol: "https", hostname: "**.olx.pl" },
      { protocol: "https", hostname: "**.cloudinary.com" },
      { protocol: "https", hostname: "**.amazonaws.com" },
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
      { source: "/downloads/estateos-android.apk", destination: "/api/downloads/estateos-android" },
      { source: "/downloads/estateos-android.aab", destination: "/api/downloads/estateos-android" },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
