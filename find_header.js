const fs = require('fs');
const path = require('path');

function searchFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            searchFiles(fullPath);
        } else if (fullPath.endsWith('.tsx')) {
            const code = fs.readFileSync(fullPath, 'utf8');
            // Szukamy plików, które mają w sobie słowa Inwestor oraz Właściciel
            if (code.toLowerCase().includes('inwestor') && (code.toLowerCase().includes('właściciel') || code.toLowerCase().includes('wlasciciel'))) {
                console.log(`\n=== ZNALEZIONO W: ${fullPath.replace(process.cwd() + '/', '')} ===`);
                const lines = code.split('\n');
                const idx = lines.findIndex(l => l.toLowerCase().includes('inwestor') && l.includes('<'));
                if (idx !== -1) {
                    const start = Math.max(0, idx - 15);
                    const end = Math.min(lines.length, idx + 25);
                    console.log(lines.slice(start, end).join('\n'));
                }
            }
        }
    }
}

console.log("=== ZAAWANSOWANE SKANOWANIE KOMPONENTU PRZEŁĄCZNIKA ===");
searchFiles(path.join(process.cwd(), 'src'));
