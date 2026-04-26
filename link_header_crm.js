const fs = require('fs');
const path = require('path');

console.log("=== BUDOWANIE MOSTU KOMUNIKACYJNEGO (HEADER <-> CRM) ===");

// 1. Usunięcie twardego reloadu z UserModeContext
const contextPath = path.join(process.cwd(), 'src', 'contexts', 'UserModeContext.tsx');
try {
  let contextCode = fs.readFileSync(contextPath, 'utf8');
  if (contextCode.includes('window.location.reload()')) {
      // Zamieniamy reload na komentarz, zostawiając sam dyspozytor eventu
      contextCode = contextCode.replace(/window\.location\.reload\(\);?/g, '// Przechodzimy na miękkie odświeżanie bez reloadu');
      fs.writeFileSync(contextPath, contextCode);
      console.log("✅ [1/2] Usunięto toporne odświeżanie strony z Headera.");
  } else {
      console.log("⚠️ Nie znaleziono window.location.reload() (może już zostało usunięte).");
  }
} catch (e) {
  console.error("❌ Błąd modyfikacji kontekstu:", e.message);
}

// 2. Wszczepienie nasłuchu (Soft-Refresh) do CRM
const crmPath = path.join(process.cwd(), 'src', 'app', 'moje-konto', 'crm', 'page.tsx');
try {
  let crmCode = fs.readFileSync(crmPath, 'utf8');
  
  // Szukamy głównego stanu danych CRM, żeby wstrzyknąć nasz most tuż pod nim
  const targetState = "const [crmData, setCrmData] = useState";
  
  if (crmCode.includes(targetState) && !crmCode.includes('syncTrigger')) {
      const injection = `
  // --- HOTFIX: Most komunikacyjny z Headerem ---
  const [syncTrigger, setSyncTrigger] = useState(0);
  
  useEffect(() => {
    const handler = () => {
       console.log("🔄 Otrzymano sygnał zmiany trybu z Headera. Miękkie odświeżanie CRM...");
       setSyncTrigger(prev => prev + 1);
    };
    window.addEventListener('userModeChanged', handler);
    return () => window.removeEventListener('userModeChanged', handler);
  }, []);

  useEffect(() => {
    if (syncTrigger > 0) {
       // Kiedy przychodzi sygnał, odświeżamy dane dla nowego trybu w tle
       const uid = (typeof currentUser !== 'undefined' && currentUser?.id) ? currentUser.id : null;
       if (uid && typeof fetchData === 'function') {
         fetchData(uid);
       }
       if (typeof fetchRadarData === 'function') {
         fetchRadarData();
       }
       // Jeśli jest dostępny setter z kontekstu, wymuszamy też przerenderowanie UI
       if (typeof setMode === 'function') {
         const currentMode = localStorage.getItem('estateos_user_mode') || 'BUYER';
         setMode(currentMode);
       }
    }
  }, [syncTrigger]);
  // ---------------------------------------------
`;
      // Wstrzyknięcie kodu zaraz po deklaracji crmData
      crmCode = crmCode.replace(/(const \[crmData,\s*setCrmData\]\s*=\s*useState[^;]+;)/, `$1\n${injection}`);
      fs.writeFileSync(crmPath, crmCode);
      console.log("✅ [2/2] Zbudowano most. CRM będzie teraz natychmiastowo reagował na Header.");
  } else if (crmCode.includes('syncTrigger')) {
      console.log("⚠️ Nasłuch (syncTrigger) jest już zaimplementowany w CRM.");
  } else {
      console.log("❌ Nie udało się bezpiecznie zlokalizować miejsca wstrzyknięcia w CRM.");
  }
} catch (e) {
  console.error("❌ Błąd modyfikacji CRM:", e.message);
}

console.log("=== GOTOWE ===");
