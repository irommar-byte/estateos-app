const fs = require('fs');
const file = 'src/components/map/InteractiveMap.tsx';

if (fs.existsSync(file)) {
    let code = fs.readFileSync(file, 'utf8');

    // 1. Dodajemy zmienną mówiącą, czy mapa jest gotowa
    if (!code.includes('const [mapLoaded')) {
        code = code.replace(
            'const [filterPrice, setFilterPrice] = useState("Wszystkie");',
            'const [filterPrice, setFilterPrice] = useState("Wszystkie");\n  const [mapLoaded, setMapLoaded] = useState(false);'
        );
    }

    // 2. Po załadowaniu mapy, zmieniamy status na gotowy
    if (!code.includes('setMapLoaded(true)')) {
        code = code.replace(
            "map.current!.on('render', updateMarkers);",
            "map.current!.on('render', updateMarkers);\n        setMapLoaded(true);"
        );
    }

    // 3. Rozkazujemy przeładować pinezki, gdy tylko mapa zgłosi gotowość
    code = code.replace(
        /}, \[filteredOffers\]\);/g,
        "}, [filteredOffers, mapLoaded]);"
    );

    fs.writeFileSync(file, code);
    console.log("Zoptymalizowano proces ładowania pinezek na starcie!");
}
