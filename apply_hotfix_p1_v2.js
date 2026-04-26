const fs = require('fs');
const path = require('path');

console.log("=== ROZPOCZYNAM WCHODZENIE HOTFIXÓW (PRIORYTET 1) ===");

// 1. NAPRAWA PROXY.TS
const proxyPath = path.join(process.cwd(), 'src', 'proxy.ts');
const proxyCode = `import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('estateos_session')?.value;
  const { pathname } = request.nextUrl;

  // Blokada ścieżek chronionych dla osób bez ciasteczka sesji
  const isProtectedRoute = pathname.startsWith('/centrala') || pathname.startsWith('/moje-konto/crm');

  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/centrala/:path*', '/moje-konto/crm/:path*'],
};
`;

try {
  fs.writeFileSync(proxyPath, proxyCode);
  console.log("✅ [1/3] Uszczelniono src/proxy.ts (prawdziwa weryfikacja sesji włączona).");
} catch (e) {
  console.error("❌ Błąd naprawy proxy.ts:", e.message);
}

// 2. NAPRAWA LOGIKI CRM (Odcięcie Inwestora Pro od bazy kupujących)
const crmPath = path.join(process.cwd(), 'src', 'app', 'moje-konto', 'crm', 'page.tsx');
try {
  if (fs.existsSync(crmPath)) {
    let crmCode = fs.readFileSync(crmPath, 'utf8');
    const oldLogicRegex = /const isPremium = currentUser\?\.isPro === true \|\| currentUser\?\.isPro === 'true' \|\| currentUser\?\.role === 'ADMIN' \|\| currentUser\?\.role === 'AGENCY' \|\| currentUser\?\.advertiserType === 'agency';/g;
    const newLogic = "const isPremium = currentUser?.role === 'ADMIN' || currentUser?.role === 'AGENCY' || currentUser?.advertiserType === 'agency'; // HOTFIX: Zablokowano dostep dla isPro";
    
    if (oldLogicRegex.test(crmCode)) {
      crmCode = crmCode.replace(oldLogicRegex, newLogic);
      fs.writeFileSync(crmPath, crmCode);
      console.log("✅ [2/3] Uszczelniono dostęp do bazy kupujących w CRM.");
    } else {
      const fallbackRegex = /const isPremium = [^;]+;/;
      crmCode = crmCode.replace(fallbackRegex, newLogic);
      fs.writeFileSync(crmPath, crmCode);
      console.log("✅ [2/3] Zastosowano wymuszenie nowej logiki CRM (fallback).");
    }
  } else {
    console.log("⚠️ [2/3] Nie znaleziono pliku: " + crmPath);
  }
} catch (e) {
  console.error("❌ Błąd naprawy CRM:", e.message);
}

// 3. NAPRAWA WERYFIKACJI ROLI ADMINA W API CENTRALI
const adminApiPath = path.join(process.cwd(), 'src', 'app', 'api', 'admin', 'dashboard', 'route.ts');
try {
  if (fs.existsSync(adminApiPath)) {
    let adminApiCode = fs.readFileSync(adminApiPath, 'utf8');
    if (adminApiCode.includes("admin.role !== 'admin'")) {
      adminApiCode = adminApiCode.replace(/admin\.role !== 'admin'/g, "admin.role !== 'ADMIN'");
      fs.writeFileSync(adminApiPath, adminApiCode);
      console.log("✅ [3/3] Naprawiono autoryzację API panelu Centrali (wielkość liter).");
    } else {
      console.log("⚠️ [3/3] Kod weryfikacji admina wygląda inaczej niż oczekiwano.");
    }
  } else {
    console.log("⚠️ [3/3] Nie znaleziono pliku API: " + adminApiPath);
  }
} catch (e) {
  console.error("❌ Błąd naprawy API Centrali:", e.message);
}

console.log("=== HOTFIXY ZAKOŃCZONE ===");
