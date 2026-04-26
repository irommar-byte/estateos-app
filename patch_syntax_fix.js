const fs = require('fs');
const file = 'src/app/dodaj-oferte/ClientForm.tsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

// Szukamy początku zepsutego bloku i jego naturalnego końca
const startIndex = lines.findIndex(l => l.includes('{/* Luksusowe przyciski Umeblowania */}'));
const endIndex = lines.findIndex((l, i) => i > startIndex && l.trim() === ')}');

if (startIndex !== -1 && endIndex !== -1) {
  const cleanBlock = [
    '                    {/* Luksusowe przyciski Umeblowania */}',
    '                    <div>',
    '                      <label className={labelPremium}>Umeblowane</label>',
    '                      <div className="flex gap-4">',
    '                        <button type="button" onClick={() => updateData({ furnished: \'Tak\' })} className={`flex-1 py-4 rounded-xl border-2 font-black uppercase tracking-widest text-[10px] transition-all ${data.furnished === \'Tak\' ? \'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]\' : \'bg-[#111] border-white/5 text-white/40 hover:border-white/20 hover:bg-white/5\'}`}>Tak</button>',
    '                        <button type="button" onClick={() => updateData({ furnished: \'Nie\' })} className={`flex-1 py-4 rounded-xl border-2 font-black uppercase tracking-widest text-[10px] transition-all ${data.furnished === \'Nie\' ? \'bg-red-500/10 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]\' : \'bg-[#111] border-white/5 text-white/40 hover:border-white/20 hover:bg-white/5\'}`}>Nie</button>',
    '                      </div>',
    '                    </div>',
    '',
    '                    {/* Pole Czynszu */}',
    '                    <div>',
    '                      <label className={labelPremium}>Czynsz administracyjny <span className="text-white/30 font-normal ml-1 text-[10px]">(Opcjonalnie)</span></label>',
    '                      <div className="relative group">',
    '                        <input type="text" placeholder="Np. 1500" className={`${inputPremium} pr-12`} value={data.rent || \'\'} onChange={(e) => updateData({ rent: e.target.value.replace(/[^0-9]/g, \'\') })} />',
    '                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 text-[10px] font-black tracking-widest uppercase">PLN</div>',
    '                      </div>',
    '                    </div>',
    '                  </>',
    '                )}'
  ];

  // Wycinamy zepsuty fragment i wstawiamy czysty kod
  lines.splice(startIndex, endIndex - startIndex + 1, ...cleanBlock);
  fs.writeFileSync(file, lines.join('\n'));
  console.log('✔ SUKCES: Kod przeczyszczony, struktura JSX naprawiona.');
} else {
  console.log('✖ BŁĄD: Nie znalazłem tagów do podmiany. Kod mógł zostać już zmodyfikowany.');
}
