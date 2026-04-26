const fs = require('fs');
const path = require('path');

console.log("=== ROZPOCZYNAM WCHODZENIE HOTFIXÓW (PRIORYTET 2 - ETAP 2) ===");

function applyRateLimit(endpointPath, limit) {
  const fullPath = path.join(process.cwd(), 'src', 'app', 'api', endpointPath, 'route.ts');
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️ Brak pliku: ${fullPath}`);
    return;
  }
  
  let code = fs.readFileSync(fullPath, 'utf8');
  if (code.includes('rateLimit')) {
    console.log(`✅ Rate limit już istnieje w ${endpointPath}`);
    return;
  }

  const importStatement = `import rateLimit from '@/lib/rateLimit';\nconst limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500 });\n`;
  code = importStatement + code;

  const postRegex = /export\s+async\s+function\s+POST\s*\(\s*([a-zA-Z0-9_]+)\s*:\s*[a-zA-Z0-9_]+\s*\)\s*\{/g;
  const match = postRegex.exec(code);
  
  if (match) {
    const reqVar = match[1]; // Pobranie nazwy zmiennej requestu (req, request itp.)
    const injection = `
  const ip = ${reqVar}.headers.get('x-forwarded-for') || '127.0.0.1';
  const { isRateLimited } = limiter.check(${limit}, ip);
  if (isRateLimited) {
    return new Response(JSON.stringify({ error: 'Zbyt wiele prób. Odczekaj 60 sekund.' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  }
`;
    code = code.slice(0, match.index + match[0].length) + injection + code.slice(match.index + match[0].length);
    fs.writeFileSync(fullPath, code);
    console.log(`✅ Wstrzyknięto Rate Limiting (${limit}/min) do ${endpointPath}`);
  } else {
    console.log(`⚠️ Nie udało się bezpiecznie namierzyć funkcji POST w ${endpointPath}`);
  }
}

// Aplikujemy limitery (5 prób logowania/rejestracji na minutę)
applyRateLimit('login', 5);
applyRateLimit('register', 5);
applyRateLimit('auth/login', 5); // Fallback w razie innej struktury
