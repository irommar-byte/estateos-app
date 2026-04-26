const fs = require('fs');
const path = require('path');

console.log("=== ROZPOCZYNAM WCHODZENIE HOTFIXÓW (PRIORYTET 3 - HIGIENA KODU) ===");
const crmPath = path.join(process.cwd(), 'src', 'app', 'moje-konto', 'crm', 'page.tsx');

try {
  let code = fs.readFileSync(crmPath, 'utf8');
  
  // Regex łapiący całe bloki zmiennych z twardymi danymi aż do zamknięcia tablicy
  const mockUsersRegex = /const mockUsers = \[[\s\S]*?\];/;
  const relationalOffersRegex = /const relationalOffers = \[[\s\S]*?\];/;

  let modified = false;

  if (mockUsersRegex.test(code)) {
    code = code.replace(mockUsersRegex, 'const mockUsers: any[] = [];');
    console.log("✅ Wygaszono sztuczną bazę użytkowników (mockUsers).");
    modified = true;
  } else {
    console.log("⚠️ Nie znaleziono bloku mockUsers.");
  }

  if (relationalOffersRegex.test(code)) {
    code = code.replace(relationalOffersRegex, 'const relationalOffers: any[] = [];');
    console.log("✅ Wygaszono sztuczną bazę ofert (relationalOffers).");
    modified = true;
  } else {
    console.log("⚠️ Nie znaleziono bloku relationalOffers.");
  }

  if (modified) {
    fs.writeFileSync(crmPath, code);
    console.log("✅ Plik CRM poprawnie wyczyszczony z atrap danych.");
  }

} catch (e) {
  console.error("❌ Błąd naprawy pliku CRM:", e.message);
}
