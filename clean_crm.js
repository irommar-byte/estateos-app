const fs = require('fs');
let code = fs.readFileSync('src/app/moje-konto/crm/page.tsx', 'utf8');
// Usuwanie przełącznika z sekcji głównej
code = code.replace(/<div className="flex justify-center mb-8 relative z-30">[\s\S]*?<PremiumModeToggle currentUser=\{currentUser\} \/>[\s\S]*?<\/div>/, '');
fs.writeFileSync('src/app/moje-konto/crm/page.tsx', code);
