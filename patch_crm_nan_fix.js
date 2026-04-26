const fs = require('fs');
const path = 'src/app/api/crm/data/route.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Usuwamy błędne linijki szukające po starych parametrach email (które generują NaN)
const lines = code.split('\n');
const safeLines = lines.filter(line => {
    if ((line.includes('sellerId') || line.includes('buyerId') || line.includes('agencyId') || line.includes('ownerId')) && line.includes('email')) {
        return false; // Usuń tę linijkę
    }
    return true; // Zostaw resztę
});

let safeCode = safeLines.join('\n');

// 2. Dodatkowe zabezpieczenie: filtrowanie tablic z wynikami NaN
safeCode = safeCode.replace(/\.map\(Number\)/g, '.map(Number).filter(n => !isNaN(n))');

fs.writeFileSync(path, safeCode);
console.log('✔ SUKCES: Wycięto zapytania generujące błąd NaN. Zakładka Transakcje odblokowana!');
