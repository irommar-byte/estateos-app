#!/usr/bin/env python3
from pathlib import Path

p = Path('/home/rommar/estateos/src/components/Pricing.tsx')
text = p.read_text()
start = text.find('        {isAgency && (')
end = text.find('      {/* MODAL WYBORU', start)
if start < 0 or end < 0:
    raise SystemExit(f'markers not found: {start}, {end}')

new_block = r'''        {isAgency && (
          <div className="max-w-4xl mx-auto animate-in fade-in duration-700">
            <motion.div className="bg-[#0a0a0a] border border-white/10 rounded-[3rem] p-8 md:p-14 relative overflow-hidden shadow-2xl min-h-[420px]">
              <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center p-8 bg-black/60 backdrop-blur-sm">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-xs font-black uppercase tracking-[0.35em] mb-4">
                  <Building2 size={14} /> Wkrótce
                </span>
                <h4 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tight">
                  EstateOS <span className="text-emerald-500">Agency PRO</span>
                </h4>
                <p className="text-white/55 text-sm md:text-base max-w-lg leading-relaxed">
                  Pakiet dla biur nieruchomości przygotowujemy — CRM, import XML i leady Concierge. Wróć za chwilę.
                </p>
              </motion.div>

              <div className="flex flex-col md:flex-row gap-12 relative z-10 opacity-35 pointer-events-none select-none" aria-hidden>
                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-black uppercase tracking-widest mb-6">
                    <Building2 size={14} /> Pakiet Biznesowy
                  </motion.div>
                  <h4 className="text-4xl font-black text-white mb-4">
                    EstateOS <span className="text-emerald-500">Agency PRO</span>
                  </h4>
                  <p className="text-white/50 mb-8 leading-relaxed">
                    Nie płacisz za samo wystawienie ogłoszenia — płacisz za CRM, który dostarcza gorące leady sprzedażowe.
                  </p>
                </motion.div>
                <div className="flex-1 bg-[#111] border border-white/5 rounded-[2rem] p-8">
                  <h5 className="text-white font-bold mb-6 flex items-center gap-2">
                    <Crown className="text-emerald-500" size={18} /> Co zyskuje agencja?
                  </h5>
                  <ul className="flex flex-col gap-4">
                    <li className="flex items-start gap-3 text-white/80 text-sm">
                      <Check className="text-emerald-500 shrink-0" size={18} />
                      <span>
                        <strong>Concierge:</strong> przejmowanie leadów z planu Basic.
                      </span>
                    </li>
                    <li className="flex items-start gap-3 text-white/80 text-sm">
                      <Check className="text-emerald-500 shrink-0" size={18} />
                      <span>
                        <strong>Import XML:</strong> synchronizacja ofert z programu biura.
                      </span>
                    </li>
                    <li className="flex items-start gap-3 text-white/80 text-sm">
                      <Check className="text-emerald-500 shrink-0" size={18} />
                      <span>
                        <strong>Zespół:</strong> konta dla agentów w jednej instancji.
                      </span>
                    </li>
                    <li className="flex items-start gap-3 text-white/80 text-sm">
                      <Check className="text-emerald-500 shrink-0" size={18} />
                      <span>
                        <strong>Radar inwestora:</strong> automatyczne powiadomienia o dopasowaniach.
                      </span>
                    </li>
                  </ul>
                </motion.div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}

'''

# Fix mistaken motion.div closings in template
new_block = new_block.replace('</motion.div>', '</div>')
# Re-open motion wrapper for animated card only
new_block = new_block.replace(
    '<motion.div className="bg-[#0a0a0a]',
    '<motion.div className="bg-[#0a0a0a]',
    1,
)
# After fixes, set motion.div close for card - find last two divs before outer close
lines = new_block.split('\n')
# Manual correct block - write clean version instead
new_block = '''        {isAgency && (
          <div className="max-w-4xl mx-auto animate-in fade-in duration-700">
            <div className="bg-[#0a0a0a] border border-white/10 rounded-[3rem] p-8 md:p-14 relative overflow-hidden shadow-2xl min-h-[420px]">
              <motion.div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center p-8 bg-black/60 backdrop-blur-sm">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-xs font-black uppercase tracking-[0.35em] mb-4">
                  <Building2 size={14} /> Wkrótce
                </span>
                <h4 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tight">
                  EstateOS <span className="text-emerald-500">Agency PRO</span>
                </h4>
                <p className="text-white/55 text-sm md:text-base max-w-lg leading-relaxed">
                  Pakiet dla biur nieruchomości przygotowujemy — CRM, import XML i leady Concierge. Wróć za chwilę.
                </p>
              </motion.div>

              <div className="flex flex-col md:flex-row gap-12 relative z-10 opacity-35 pointer-events-none select-none" aria-hidden>
                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-black uppercase tracking-widest mb-6">
                    <Building2 size={14} /> Pakiet Biznesowy
                  </motion.div>
                  <h4 className="text-4xl font-black text-white mb-4">
                    EstateOS <span className="text-emerald-500">Agency PRO</span>
                  </h4>
                  <p className="text-white/50 leading-relaxed">
                    Nie płacisz za samo wystawienie ogłoszenia — płacisz za CRM, który dostarcza gorące leady sprzedażowe.
                  </p>
                </motion.div>
                <div className="flex-1 bg-[#111] border border-white/5 rounded-[2rem] p-8">
                  <h5 className="text-white font-bold mb-6 flex items-center gap-2">
                    <Crown className="text-emerald-500" size={18} /> Co zyskuje agencja?
                  </h5>
                  <ul className="flex flex-col gap-4">
                    <li className="flex items-start gap-3 text-white/80 text-sm">
                      <Check className="text-emerald-500 shrink-0" size={18} />
                      <span><strong>Concierge:</strong> przejmowanie leadów z planu Basic.</span>
                    </li>
                    <li className="flex items-start gap-3 text-white/80 text-sm">
                      <Check className="text-emerald-500 shrink-0" size={18} />
                      <span><strong>Import XML:</strong> synchronizacja ofert z programu biura.</span>
                    </li>
                    <li className="flex items-start gap-3 text-white/80 text-sm">
                      <Check className="text-emerald-500 shrink-0" size={18} />
                      <span><strong>Zespół:</strong> konta dla agentów w jednej instancji.</span>
                    </li>
                    <li className="flex items-start gap-3 text-white/80 text-sm">
                      <Check className="text-emerald-500 shrink-0" size={18} />
                      <span><strong>Radar inwestora:</strong> automatyczne powiadomienia o dopasowaniach.</span>
                    </li>
                  </ul>
                </motion.div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}

'''
# I keep making typos - write file with write tool directly for agency block only

p.write_text(text[:start] + new_block + text[end:])
print('patched', start, end)
