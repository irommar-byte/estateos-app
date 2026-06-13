import 'dotenv/config';

const draft = {
  title: 'Mieszkanie 4 pokoje Ursus',
  city: 'Warszawa',
  district: 'Ursus',
  neighborhood: '',
  transactionType: 'SALE',
  propertyType: 'APARTMENT',
  price: 795000,
  area: 62.2,
  rooms: 4,
  floor: 2,
  totalFloors: 5,
  yearBuilt: null,
  adminFee: null,
  deposit: null,
  features: [
    'Cena za m²: 12781.35 zł/m²',
    'Poziom: 2',
    'Umeblowane: Tak',
    'Rynek: Wtórny',
    'Rodzaj zabudowy: Blok',
    'Powierzchnia: 62,20 m²',
    'Liczba pokoi: 4 i więcej',
    'balkon',
    'piwnica',
  ],
  descriptionHtml: '',
  descriptionText: `Bez pośredników, sprzedaż prywatna.
Sprzedajemy 62,2 m² gotowe do zamieszkania, z pełnym wyposażeniem, pięknymi meblami mieszkanie na drugim piętrze.
Mamy do sprzedania mieszkanie dwustronnie oświetlone, ciepłe, bardzo przytulne, posiadające 4 pokoje, kuchnie, osobną łazienkę i WC, balkon oraz przypisaną do mieszkania osobną piwnicę oraz wspólną komórkę na rowery, wózki, dodatkowe pranie.
Mieszkanie wyposażone jest we wszystkie urządzenia, takie jak pralka, zmywarka, lodówka, kuchnia gazowa, telewizor, meble, piękne szafy zabudowane Ikea, kanapy, dywany, biurka, zasłony, firanki. To wszystko zostaje dla kupujących takze tak naprawdę można wprowadzić się tutaj od razu.
W trzech pokojach są piękne jasne, niedawno wymieniane, wysokiej jakości wodoodporne panele-było to dla mnie bardzo ważne przy małych dzieciach.
Mieszkanie znajduje się w dobrze skomunikowanej lokalizacji, blisko przystanków autobusowych i stacji kolejowej PKP Ursus Niedźwiadek (350m / 4 min pieszo), skąd SKM dociera w 15 minut do stacji PKP Śródmieście.
Dookoła jest dosłownie wszystko czego potrzebujesz do codziennego funkcjonowania. W minutę dojdziesz do licznych sklepów typu Rossman, Biedronka, Poczta Polska, 3 apteki, warzywniaków.
Obok jest wielki, wspaniały plac Zabaw Hasanka i ponad 10 placów zabaw w obrębie do 1 km.
Mieszkanie spółdzielczo własnościowe z Księgą Wieczystą.
Zapraszamy do obejrzenia mieszkania i przekonania się osobiście, że naprawdę genialnie się tutaj mieszka i negocjacji ceny.
Dodam, że sąsiedzi są bardzo spokojni, a myślę że to też bardzo ważny argument jak się mieszka w bloku:)`,
};

const { buildOtodomPresentationCopy } = await import('../src/lib/otodomImportRewrite.ts');

const OWNER_BAD = [
  /bez\s+pośredników/i,
  /sprzeda[żz]\s+prywatn/i,
  /\bmamy\s+do\s+sprzedania/i,
  /\bsprzedajemy\b/i,
  /\bja\s+jako\b/i,
  /\bbyłam\b/i,
  /cena\s+za\s+m²/i,
];

const result = await buildOtodomPresentationCopy(draft, { agentVoice: true, forceAi: true });
const plain = result.descriptionPreview;

console.log('rewrittenByAi:', result.rewrittenByAi);
console.log('aiSkipReason:', result.aiSkipReason || '—');
console.log('plain length:', plain.length);

const failures = OWNER_BAD.filter((p) => p.test(plain));
if (failures.length) {
  console.log('FAIL owner/price patterns:', failures.map(String));
  process.exit(1);
}
if (!result.rewrittenByAi) {
  console.log('FAIL not rewritten by AI');
  process.exit(1);
}
if (plain.length < 400) {
  console.log('FAIL too short');
  process.exit(1);
}
console.log('PASS');
console.log('---');
console.log(result.descriptionHtml.replace(/></g, '>\n<'));
