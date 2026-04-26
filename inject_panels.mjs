import fs from 'fs';

const file = 'src/app/moje-konto/crm/page.tsx';
let code = fs.readFileSync(file, 'utf8');
let changed = false;

// 1. Dodajemy niezbędne ikony
if (!code.includes('Menedżer Ogłoszeń')) {
    code = code.replace(
        /import \{ Building, Wallet, Radar, Key, Sparkles \} from ['"]lucide-react['"];?/,
        "import { Building, Wallet, Radar, Key, Sparkles, LayoutGrid, CalendarDays } from 'lucide-react';"
    );
    console.log('✅ Dodano import nowych ikon.');
    changed = true;
}

// 2. Szukamy starego, pojedynczego widoku Radaru (od linii 369) i usuwamy go
const oldRadarViewRegex = /\{activeTab === 'radar' && \(\s*<>\s*<div className="bg-emerald-500\/5[^]*?<\/>\s*\)\}/;

// 3. Budujemy nową strukturę z trzema panelami (w trybie SELLER)
const newThreePanels = `
        {/* 🔥 NOWA STRUKTURA: Trzy Panele w Grida 🔥 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10 mb-12">
          {/* Panel 1: Radar Kupców */}
          <div className="bg-[#111] border border-emerald-500/20 rounded-[3rem] p-8 flex flex-col items-center gap-6 text-center shadow-[0_0_50px_rgba(16,185,129,0.05)]">
            <div className="relative w-24 h-24 bg-black/50 border border-emerald-500/50 rounded-full flex items-center justify-center shrink-0 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <Radar size={50} className="text-emerald-500" strokeWidth={1}/>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }} className="absolute -inset-2 border border-emerald-500/20 rounded-full" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tighter mb-2">Radar <span className="text-emerald-500">Kupców</span></h2>
              <p className="text-white/60 text-sm leading-relaxed">Algorytm skanuje bazę zweryfikowanych inwestorów i dobiera kupców pod Twoje oferty. Wyślij im ekskluzywne powiadomienie PUSH, zanim ktokolwiek dowie się o sprzedaży.</p>
            </div>
          </div>

          {/* Panel 2: Menedżer Ogłoszeń */}
          <div className="bg-[#111] border border-white/5 rounded-[3rem] p-8 flex flex-col items-center gap-6 text-center">
            <div className="relative w-24 h-24 bg-black/50 border border-white/10 rounded-full flex items-center justify-center shrink-0 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]">
                <LayoutGrid size={50} className="text-white/50" strokeWidth={1}/>
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tighter mb-2">Menedżer Ogłoszeń</h2>
              <p className="text-white/40 text-sm leading-relaxed">Edytuj ogłoszenia, sprawdzaj statystyki wyświetleń, zarządzaj zdjęciami i aktualizuj ceny swoich nieruchomości. Zyskaj pełną kontrolę nad procesem sprzedaży.</p>
            </div>
          </div>

          {/* Panel 3: Centrum Planowania */}
          <div className="bg-[#111] border border-white/5 rounded-[3rem] p-8 flex flex-col items-center gap-6 text-center">
            <div className="relative w-24 h-24 bg-black/50 border border-white/10 rounded-full flex items-center justify-center shrink-0 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]">
                <CalendarDays size={50} className="text-white/50" strokeWidth={1}/>
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tighter mb-2">Centrum Planowania</h2>
              <p className="text-white/40 text-sm leading-relaxed">Umawiaj prezentacje nieruchomości, zarządzaj spotkaniami negocjacyjnymi i koordynuj kalendarz z kupującymi oraz agentami. Twój czas jest kluczowy.</p>
            </div>
          </div>
        </div>
`;

// Wstrzykujemy nową strukturę
if (code.match(oldRadarViewRegex)) {
    code = code.replace(oldRadarViewRegex, newThreePanels);
    console.log('✅ Nadpisano stary widok Radaru nową strukturą z trzema panelami.');
    changed = true;
} else {
    console.log('❌ BŁĄD: Nie mogłem znaleźć starego widoku Radaru do podmiany.');
}

if (changed) {
    fs.writeFileSync(file, code);
}
