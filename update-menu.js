const fs = require('fs');
const file = 'src/components/layout/Navbar.tsx';
if(fs.existsSync(file)) {
    let code = fs.readFileSync(file, 'utf8');
    const target = '<Link href="/dodaj-oferte" onClick={() => setIsOpen(false)} className="text-4xl md:text-6xl font-bold tracking-tighter hover:text-white/40 transition-colors">Zgłoś <span className="text-white/30 italic">Wnętrze</span></Link>';
    const insert = '<button onClick={() => { setIsOpen(false); window.dispatchEvent(new Event(\'open-welcome-gate\')); }} className="text-4xl md:text-6xl font-bold tracking-tighter hover:text-white/40 transition-colors bg-transparent border-none cursor-pointer m-0 p-0">Znajdź <span className="text-white/30 italic">Wnętrze</span></button>';
    if (!code.includes('open-welcome-gate')) {
        code = code.replace(target, target + '\n            ' + insert);
        fs.writeFileSync(file, code);
        console.log('Menu zaktualizowane o opcję "Znajdź Wnętrze"!');
    }
}
