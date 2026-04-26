const fs = require('fs');
const path = 'src/app/moje-konto/crm/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// Szukamy ostatniego warunku w nagłówku h2 (planowanie)
const searchStr = "{activeTab === 'planowanie' && <>Centrum <span className=\"text-purple-500\">Planowania</span></>}";

// Wstawiamy go z powrotem, dodając pod spodem nowy warunek dla transakcji
const replaceStr = "{activeTab === 'planowanie' && <>Centrum <span className=\"text-purple-500\">Planowania</span></>}\n                {activeTab === 'transakcje' && <>Szyfrowane <span className=\"text-emerald-500\">Deal Roomy</span></>}";

if (code.includes(searchStr) && !code.includes("activeTab === 'transakcje' && <>Szyfrowane")) {
    code = code.replace(searchStr, replaceStr);
    fs.writeFileSync(path, code);
    console.log('✔ SUKCES: Dodano brakujący nagłówek dla Deal Roomów w page.tsx!');
} else {
    console.log('✖ UWAGA: Nie znaleziono znacznika lub nagłówek został już dodany.');
}
