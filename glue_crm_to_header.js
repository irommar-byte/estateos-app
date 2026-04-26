const fs = require('fs');
const path = require('path');

console.log("=== BEZPOŚREDNIE KLEJENIE CRM Z NAGŁÓWKIEM (DIRECT GLUE) ===");

const crmPath = path.join(process.cwd(), 'src', 'app', 'moje-konto', 'crm', 'page.tsx');

try {
  let code = fs.readFileSync(crmPath, 'utf8');

  // 1. Wstrzyknięcie kuloodpornego, lokalnego stanu powiązanego z przeglądarką
  const directGlueCode = `
  // --- DIRECT GLUE: Błyskawiczny, natywny stan połączony z przełącznikiem ---
  const [localMode, setLocalMode] = useState(typeof window !== 'undefined' ? localStorage.getItem('estateos_user_mode') || 'BUYER' : 'BUYER');

  useEffect(() => {
      const handleModeSync = () => {
          const current = localStorage.getItem('estateos_user_mode') || 'BUYER';
          if (current !== localMode) {
              setLocalMode(current);
              // Wymuszenie przeładowania danych w ułamku sekundy
              const uid = currentUser?.id || (typeof user !== 'undefined' ? user?.id : null);
              if (uid && typeof fetchData === 'function') fetchData(uid);
              if (typeof fetchRadarData === 'function') fetchRadarData();
          }
      };
      
      window.addEventListener('userModeChanged', handleModeSync);
      handleModeSync(); // Wymuszenie synchronizacji przy pierwszym ładowaniu
      
      return () => window.removeEventListener('userModeChanged', handleModeSync);
  }, [localMode]); 
  // --------------------------------------------------------------------------
  `;

  if (!code.includes('DIRECT GLUE: Błyskawiczny')) {
      code = code.replace(/(const \[[^\]]+\] = useState[^;]+;)/, `$1\n${directGlueCode}`);
  }

  // 2. Usunięcie starego, wadliwego nasłuchu z poprzedniej próby
  code = code.replace(/\/\/ --- NATIVE REACT: Wymuszenie[\s\S]*?\/\/ -------------------------------------------------------------------/g, '');

  // 3. Zamiana zmiennej "mode" (z felernego Kontekstu) na nasz "localMode" w całym CRM
  code = code.replace(/mode\s*===\s*'BUYER'/g, "localMode === 'BUYER'");
  code = code.replace(/mode\s*===\s*'SELLER'/g, "localMode === 'SELLER'");
  code = code.replace(/mode\s*===\s*'AGENCY'/g, "localMode === 'AGENCY'");
  code = code.replace(/mode\s*!==\s*'BUYER'/g, "localMode !== 'BUYER'");
  
  // 4. NAPRAWA BŁĘDU ZE ZRZUTU EKRANU (Odblokowanie zabetonowanego tekstu)
  code = code.replace(/>\s*PANEL INWESTORA\s*</gi, ">{localMode === 'BUYER' ? 'PANEL INWESTORA' : localMode === 'SELLER' ? 'PANEL WŁAŚCICIELA' : 'PANEL PARTNERA'}<");

  fs.writeFileSync(crmPath, code);
  console.log("✅ Wdrożono Direct Glue. Interfejs jest teraz posklejany i dynamiczny.");
} catch(e) {
  console.error("❌ Błąd:", e.message);
}
