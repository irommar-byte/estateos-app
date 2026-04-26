const fs = require('fs');
const path = require('path');

console.log("=== ROZPOCZYNAM WCHODZENIE HOTFIXÓW (PRIORYTET 2 - ETAP 1) ===");

// 1. ZABEZPIECZENIE NEXT.CONFIG.TS
const configPath = path.join(process.cwd(), 'next.config.ts');
const configCode = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
`;

try {
  fs.writeFileSync(configPath, configCode);
  console.log("✅ [1/2] Nadpisano next.config.ts twardymi nagłówkami bezpieczeństwa.");
} catch (e) {
  console.error("❌ Błąd modyfikacji next.config.ts:", e.message);
}

// 2. FUNDAMENT RATE LIMITINGU
const libPath = path.join(process.cwd(), 'src', 'lib');
if (!fs.existsSync(libPath)) {
  fs.mkdirSync(libPath, { recursive: true });
}

const rlPath = path.join(libPath, 'rateLimit.ts');
const rlCode = `import { LRUCache } from 'lru-cache';

export default function rateLimit(options: { interval: number; uniqueTokenPerInterval: number }) {
  const tokenCache = new LRUCache({
    max: options.uniqueTokenPerInterval || 500,
    ttl: options.interval || 60000,
  });

  return {
    check: (limit: number, token: string) => {
      const tokenCount = (tokenCache.get(token) as number) || 0;
      if (tokenCount === 0) {
        tokenCache.set(token, 1);
      } else {
        tokenCache.set(token, tokenCount + 1);
      }
      const isRateLimited = tokenCount + 1 > limit;
      return { isRateLimited, currentUsage: tokenCount + 1 };
    },
  };
}
`;

try {
  fs.writeFileSync(rlPath, rlCode);
  console.log("✅ [2/2] Utworzono moduł weryfikacji żądań: src/lib/rateLimit.ts");
} catch (e) {
  console.error("❌ Błąd tworzenia modułu rateLimit.ts:", e.message);
}

console.log("=== HOTFIXY ETAPU 1 ZAKOŃCZONE ===");
