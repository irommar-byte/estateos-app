const fs = require('fs');
const path = require('path');

console.log("=== AKTUALIZACJA STATUSU SYSTEMU (APPLE STYLE) ===");

const togglePath = path.join(process.cwd(), 'src', 'components', 'ui', 'PremiumModeToggle.tsx');

try {
  let code = fs.readFileSync(togglePath, 'utf8');

  const oldSpanRegex = /<span className="[^"]*text-\[8px\][^"]*">[\s\S]*?Wybór Przestrzeni Pracy[\s\S]*?<\/span>/;
  
  const newStatusUI = `
      {/* STATUS SYSTEMU - APPLE HARDWARE STYLE */}
      <div className="flex items-center gap-2 mb-3 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] z-10 relative">
        <div className="relative flex items-center justify-center w-2 h-2">
          <div className="absolute inset-0 bg-emerald-500 rounded-full blur-[3px] opacity-80 animate-pulse"></div>
          <div className="relative w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,1)]"></div>
        </div>
        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] text-white/60">
          EstateOS™ Core: Online <span className="opacity-40 ml-1">// Przestrzeń Pracy</span>
        </span>
      </div>
  `;

  if (oldSpanRegex.test(code)) {
      code = code.replace(oldSpanRegex, newStatusUI);
      fs.writeFileSync(togglePath, code);
      console.log("✅ Wdrożono nowy, luksusowy status systemu nad przełącznikiem.");
  } else {
      console.log("⚠️ Nie znaleziono starego napisu (może został już zmieniony).");
  }

} catch (e) {
  console.error("❌ Błąd modyfikacji pliku:", e.message);
}
