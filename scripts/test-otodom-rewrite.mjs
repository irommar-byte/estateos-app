import 'dotenv/config';

const draft = {
  title: 'Mieszkanie na sprzedaż',
  city: 'Warszawa',
  district: 'Tarchomin',
  neighborhood: '',
  transactionType: 'SALE',
  propertyType: 'APARTMENT',
  price: 599500,
  area: 45.7,
  rooms: 1,
  floor: 2,
  totalFloors: 3,
  yearBuilt: 2003,
  adminFee: null,
  deposit: null,
  features: ['balkon'],
  descriptionHtml: '',
  descriptionText: `Na sprzedaż komfortowe mieszkanie jednopokojowe o powierzchni 45,7 m2, położone w spokojnej części Warszawy przy ul. Myśliborskiej.

W skład mieszkania wchodzi:
pokój dzienny z wyjściem na balkon - 26,5 m2,
kuchnia otwarta - 8 m2,
przedpokój - 7,2 m2,
łazienka - 4 m2,
balkon - 6,2 m2.

Układ mieszkania daje możliwość wydzielenia drugiego pokoju, dzięki czemu lokal można łatwo dostosować do własnych potrzeb - idealny zarówno dla singla, pary, jak i jako inwestycja.

Lokal posiada okna na stronę południową.

Cicha, zielona okolica z doskonałą komunikacją i pełną infrastrukturą - w pobliżu szkoła, przedszkole, kościół, przychodnia lekarska, sklepy - Galeria Północna, tramwaj i autobus (10 min. do metra Młociny), tereny spacerowe i ścieżki rowerowe.

Mieszkanie nie jest obciążone - hipoteka czysta.

Sprzedaż bezpośrednia.`,
};

const { buildOtodomPresentationCopy } = await import('../src/lib/otodomImportRewrite.ts');

const result = await buildOtodomPresentationCopy(draft, { agentVoice: true });
console.log('rewrittenByAi:', result.rewrittenByAi);
console.log('aiSkipReason:', result.aiSkipReason || '—');
console.log('title:', result.title);
console.log('plain length:', result.descriptionPreview.length);
console.log('---');
console.log(result.descriptionHtml.replace(/></g, '>\n<'));
