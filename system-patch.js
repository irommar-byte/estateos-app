const fs = require('fs');

// 1. NAPRAWA MAPY (Niezawodne ładowanie klastrów na starcie)
const mapFile = 'src/components/map/InteractiveMap.tsx';
if (fs.existsSync(mapFile)) {
    let mapCode = fs.readFileSync(mapFile, 'utf8');
    const oldSetData = "(map.current.getSource('offers') as mapboxgl.GeoJSONSource).setData({ type: 'FeatureCollection', features });";
    const newSetData = `const source = map.current.getSource('offers') as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData({ type: 'FeatureCollection', features });
        // Niezawodny fallback dla silnika Mapbox
        const fallbackTimer = setInterval(() => {
          if (map.current?.isStyleLoaded()) {
            source.setData({ type: 'FeatureCollection', features });
            clearInterval(fallbackTimer);
          }
        }, 500);
        setTimeout(() => clearInterval(fallbackTimer), 5000);
      }`;
    mapCode = mapCode.replace(oldSetData, newSetData);
    fs.writeFileSync(mapFile, mapCode);
}

// 2. PRZYCISKI EDYCJI W CENTRALI
const adminFile = 'src/app/admin/page.tsx';
if (fs.existsSync(adminFile)) {
    let code = fs.readFileSync(adminFile, 'utf8');
    code = code.replace(/<button onClick=\{\(\) => handleDelete\(offer\.id\)\}/g, '<Link href={`/edytuj-oferte/${offer.id}`} className="px-5 py-3 bg-white/10 text-white font-bold rounded-full text-xs hover:bg-white hover:text-black transition-colors">Edytuj</Link> <button onClick={() => handleDelete(offer.id)}');
    fs.writeFileSync(adminFile, code);
}

// 3. PRZYCISKI EDYCJI W PANELU KLIENTA
const kontoFile = 'src/app/moje-konto/page.tsx';
if (fs.existsSync(kontoFile)) {
    let code = fs.readFileSync(kontoFile, 'utf8');
    code = code.replace(/(<Link href=\{\`\/oferta\/\$\{offer\.id\}\`\}[^>]*>.*?<\/Link>)/g, '<div className="flex items-center gap-5"><Link href={`/edytuj-oferte/${offer.id}`} className="text-[10px] text-emerald-500 hover:text-emerald-400 uppercase tracking-[0.2em] font-bold transition-colors">Edytuj</Link> $1 </div>');
    fs.writeFileSync(kontoFile, code);
}

console.log("System spatchowany pomyślnie!");
