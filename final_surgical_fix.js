const fs = require('fs');
const path = require('path');

// 1. NAPRAWA KONTEKSTU (Logika + Sygnał)
const ctxPath = path.join(process.cwd(), 'src', 'contexts', 'UserModeContext.tsx');
if (fs.existsSync(ctxPath)) {
    let code = fs.readFileSync(ctxPath, 'utf8');
    // Wstrzykujemy sygnał bezpośrednio do momentu zmiany trybu w selectMode (linia ~78)
    const target = 'localStorage.setItem("estateos_user_mode", newMode);';
    const injection = target + '\n        if (typeof window !== "undefined") window.dispatchEvent(new Event("userModeChanged"));';
    code = code.split(target).join(injection);
    fs.writeFileSync(ctxPath, code);
    console.log("✅ Logika selectMode naprawiona - sygnał będzie wysyłany.");
}

// 2. WSTRZYKNIĘCIE MODALU DO LAYOUTU (Żarówka do pokoju)
const layoutPath = path.join(process.cwd(), 'src', 'app', 'layout.tsx');
if (fs.existsSync(layoutPath)) {
    let code = fs.readFileSync(layoutPath, 'utf8');
    
    // Sprawdzamy czy mamy komponent modalu (jeśli nie, musimy go zaimportować)
    if (!code.includes('UpgradeModal')) {
        // Dodajemy import (zakładając że go stworzymy za chwilę)
        code = "import UpgradeModal from '@/components/ui/UpgradeModal';\n" + code;
        // Wkładamy go przed zamknięciem Body
        code = code.replace('</body>', '  <UpgradeModal />\n      </body>');
        fs.writeFileSync(layoutPath, code);
        console.log("✅ UpgradeModal wstrzyknięty do głównego layoutu.");
    }
}

// 3. STWORZENIE BRAKUJĄCEGO KOMPONENTU (Luksusowy Modal Apple Style)
const modalDir = path.join(process.cwd(), 'src', 'components', 'ui');
if (!fs.existsSync(modalDir)) fs.mkdirSync(modalDir, { recursive: true });

const modalCode = `
'use client';
import { useUserMode } from '@/contexts/UserModeContext';
import { X, Crown, Shield, Zap } from 'lucide-react';

export default function UpgradeModal() {
  const { isUpgradeModalOpen, setIsUpgradeModalOpen, upgradeModalType } = useUserMode();

  if (!isUpgradeModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden">
        {/* Dekoracja tła */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 blur-[100px]" />
        
        <button onClick={() => setIsUpgradeModalOpen(false)} className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors">
          <X size={24} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(52,211,153,0.3)]">
            {upgradeModalType === 'AGENCY' ? <Shield className="text-black" size={32} /> : <Crown className="text-black" size={32} />}
          </div>

          <h2 className="text-2xl font-black uppercase tracking-tighter text-white mb-2">
            Wymagana Subskrypcja {upgradeModalType === 'AGENCY' ? 'AGENCJA' : 'INWESTOR PRO'}
          </h2>
          
          <p className="text-white/60 text-sm mb-8 leading-relaxed">
            Tryb {upgradeModalType === 'AGENCY' ? 'Partnera' : 'Właściciela'} jest dostępny wyłącznie dla zweryfikowanych użytkowników z aktywnym planem premium.
          </p>

          <div className="w-full space-y-3">
            <button className="w-full py-4 bg-white text-black rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-emerald-400 transition-all flex items-center justify-center gap-2">
              <Zap size={16} fill="black" /> Aktywuj dostęp teraz
            </button>
            <button onClick={() => setIsUpgradeModalOpen(false)} className="w-full py-4 bg-white/5 text-white/40 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-white/10 transition-all">
              Może później
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync(path.join(modalDir, 'UpgradeModal.tsx'), modalCode);
console.log("✅ Stworzono brakujący komponent UpgradeModal.tsx");
