/**
 * Next.js 16: nie można mieć jednocześnie middleware.* i proxy.*
 * Usuwa typowe przypadki pozostawione po migracji (np. podwójny katalog src/src).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const TO_REMOVE = [
  path.join(root, 'src', 'src', 'middleware.ts'),
  path.join(root, 'src', 'src', 'middleware.js'),
  path.join(root, 'src', 'middleware.ts'),
  path.join(root, 'src', 'middleware.js'),
  path.join(root, 'middleware.ts'),
  path.join(root, 'middleware.js'),
  // Zły duplikat ścieżki (src/src) — Next widzi drugi proxy obok właściwego src/proxy.ts
  path.join(root, 'src', 'src', 'proxy.ts'),
  path.join(root, 'src', 'src', 'proxy.js'),
  // Statyczne kopie .well-known blokują Route Handlers — wtedy iOS dostaje niepełny JSON (np. tylko webcredentials).
  path.join(root, 'public', '.well-known', 'apple-app-site-association'),
  path.join(root, 'public', '.well-known', 'assetlinks.json'),
];

for (const file of TO_REMOVE) {
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.warn('[purge-legacy-middleware] Usunięto:', path.relative(root, file));
    }
  } catch (e) {
    console.error('[purge-legacy-middleware] Nie można usunąć', file, e);
    process.exit(1);
  }
}

// Cały katalog public/.well-known — dowolny plik tutaj ma pierwszeństwo nad Route Handlerem i psuje AASA (np. sam webcredentials).
const wellKnownDir = path.join(root, 'public', '.well-known');
try {
  if (fs.existsSync(wellKnownDir)) {
    for (const name of fs.readdirSync(wellKnownDir)) {
      const fp = path.join(wellKnownDir, name);
      try {
        const st = fs.statSync(fp);
        if (st.isFile()) {
          fs.unlinkSync(fp);
          console.warn('[purge-legacy-middleware] Usunięto public/.well-known/', name);
        }
      } catch (e) {
        console.error('[purge-legacy-middleware]', fp, e);
        process.exit(1);
      }
    }
  }
} catch (e) {
  console.error('[purge-legacy-middleware] .well-known dir', e);
  process.exit(1);
}
