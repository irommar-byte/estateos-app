const fs = require('fs');
const path = require('path');

const togglePath = path.join(process.cwd(), 'src', 'components', 'ui', 'PremiumModeToggle.tsx');

try {
  if (fs.existsSync(togglePath)) {
    let code = fs.readFileSync(togglePath, 'utf8');
    
    // Wyszukujemy i usuwamy cały blok dodany w poprzednich krokach
    const statusRegex = /\{\/\*\s*STATUS SYSTEMU - APPLE HARDWARE STYLE\s*\*\/\}\s*<div[\s\S]*?EstateOS™ Core: Online[\s\S]*?<\/span>\s*<\/div>/;
    
    if (statusRegex.test(code)) {
        code = code.replace(statusRegex, '');
        fs.writeFileSync(togglePath, code);
        console.log("✅ Usunięto napis 'ESTATEOS™ CORE: ONLINE // PRZESTRZEŃ PRACY' z samego szczytu.");
    } else {
        console.log("⚠️ Nie znaleziono napisu. Być może został już usunięty.");
    }
  } else {
    console.log("❌ Nie znaleziono pliku PremiumModeToggle.tsx.");
  }
} catch (e) {
  console.error("❌ Błąd modyfikacji:", e.message);
}
