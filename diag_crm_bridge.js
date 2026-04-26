const fs = require('fs');
const path = require('path');

console.log("=== DIAGNOSTYKA MOSTU KOMUNIKACYJNEGO (100% PEWNOŚCI) ===\n");

// 1. Sprawdzamy, czy selectMode wysyła nasz sygnał
const ctxPath = path.join(process.cwd(), 'src', 'contexts', 'UserModeContext.tsx');
try {
    const ctx = fs.readFileSync(ctxPath, 'utf8');
    const selectModeMatch = ctx.match(/const selectMode =[\s\S]*?localStorage\.setItem\([^)]+\);([\s\S]*?)\}/);
    console.log("[DOWÓD 1] Końcówka funkcji selectMode w Kontekście:");
    console.log(selectModeMatch ? selectModeMatch[0] : "❌ Nie znaleziono selectMode.");
} catch(e) { console.log("Błąd odczytu UserModeContext"); }

console.log("\n---------------------------------------------------\n");

// 2. Sprawdzamy, jak CRM reaguje na tryb
const crmPath = path.join(process.cwd(), 'src', 'app', 'moje-konto', 'crm', 'page.tsx');
try {
    const crm = fs.readFileSync(crmPath, 'utf8');
    
    const useModeMatch = crm.match(/const\s+\{[^}]*mode[^}]*\}\s*=\s*useUserMode\(\)/);
    console.log("[DOWÓD 2] Czy CRM subskrybuje globalny tryb (useUserMode)?");
    console.log(useModeMatch ? "✅ TAK: " + useModeMatch[0] : "❌ NIE (To może być przyczyna braku reakcji)");

    console.log("\n[DOWÓD 3] Zależności (Dependencies) odświeżania w CRM:");
    // Szukamy hooków useEffect zawierających fetchData lub fetchRadarData
    const useEffects = crm.match(/useEffect\(\(\) => \{[\s\S]*?(?:fetch|set)[^\}]*\}, \[(.*?)\]\);/g);
    if (useEffects) {
        useEffects.forEach(effect => {
            if (effect.includes('fetchData') || effect.includes('syncTrigger') || effect.includes('mode')) {
                const lines = effect.split('\n');
                console.log(lines[0] + " ... " + lines[lines.length-1]);
            }
        });
    } else {
        console.log("❌ Nie znaleziono nasłuchujących useEffectów.");
    }
} catch(e) { console.log("Błąd odczytu CRM"); }

console.log("\n=== KONIEC DIAGNOSTYKI ===");
