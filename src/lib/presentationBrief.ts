export type BriefStage = {
  step: string;
  title: string;
  say: string[];
  watch: string[];
};

export type BriefSpec = { label: string; value: string };

export type PresentationBrief = {
  headline: string;
  address: string;
  stages: BriefStage[];
  specs: BriefSpec[];
};

function text(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function plainDescription(value: unknown): string {
  const raw = String(value ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return '';
  const cut = raw.slice(0, 280);
  const dot = cut.lastIndexOf('. ');
  if (dot > 80) return cut.slice(0, dot + 1);
  return raw.length > 280 ? `${cut.replace(/[,:;–—-]+$/g, '').trim()}…` : raw;
}

function money(value: unknown): string | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${Math.round(n).toLocaleString('pl-PL')} zł`;
}

function flag(offer: Record<string, unknown>, key: string): boolean {
  const value = offer[key];
  return value === true || value === 1 || value === '1' || value === 'true';
}

function floorLabel(offer: Record<string, unknown>): string | null {
  const floor = offer.floor;
  if (floor == null || text(floor) === '') return null;
  const n = Number(floor);
  const current = Number.isFinite(n) && n === 0 ? 'parter' : `${text(floor)}. piętro`;
  const total = Number(offer.totalFloors);
  if (Number.isFinite(total) && total > 0) return `${current} z ${total}`;
  return current;
}

export function buildPresentationBrief(offer: Record<string, unknown> | null, fallbackTitle: string): PresentationBrief {
  const row = offer || {};
  const title = text(row.title) || fallbackTitle || 'Nieruchomość';
  const street = text(row.street);
  const district = text(row.district);
  const city = text(row.city);
  const address = [street, district, city].filter(Boolean).join(', ') || 'adres na ofertówce';
  const price = money(row.pricePln ?? row.price);
  const perSqm = money(row.pricePerSqm);
  const area = Number(row.area);
  const areaLabel = Number.isFinite(area) && area > 0 ? `${area} m²` : null;
  const rooms = Number(row.rooms);
  const roomsLabel = Number.isFinite(rooms) && rooms > 0 ? `${rooms}` : null;
  const floor = floorLabel(row);
  const year = text(row.yearBuilt || row.buildYear || row.buildYearLabel);
  const heating = text(row.heating);
  const fee = money(row.adminFee);
  const condition = text(row.conditionLabel) || text(row.condition);
  const kind = text(row.propertyTypeLabel) || 'nieruchomość';
  const deal = text(row.transactionType).toUpperCase() === 'RENT' ? 'wynajem' : 'sprzedaż';
  const description = plainDescription(row.description);

  const amenities = [
    flag(row, 'hasBalcony') ? 'balkon' : '',
    flag(row, 'hasElevator') ? 'winda' : '',
    flag(row, 'hasParking') ? 'parking' : '',
    flag(row, 'hasStorage') ? 'komórka lokatorska' : '',
    flag(row, 'hasGarden') ? 'ogród' : '',
    flag(row, 'hasAirConditioning') ? 'klimatyzacja' : '',
    flag(row, 'isFurnished') ? 'umeblowane' : '',
    flag(row, 'isDuplex') ? 'układ dwupoziomowy' : '',
  ].filter(Boolean);

  const opener = [
    `Zacznij od adresu: ${address}.`,
    price ? `Cena: ${price}${perSqm ? `, czyli około ${perSqm} za m²` : ''}.` : 'Cenę podaj z ofertówki, zanim wejdziecie do środka.',
    [kind, deal, areaLabel, roomsLabel ? `${roomsLabel} pokoje` : ''].filter(Boolean).join(', ') + '.',
  ];

  const entranceSay = [
    'Zatrzymaj się w progu i daj klientowi 10 sekund ciszy. Potem nazwij to, co widać: światło, układ, stan.',
    floor ? `Piętro powiedz od razu: ${floor}.` : '',
    year ? `Rok budowy: ${year}.` : '',
    flag(row, 'hasElevator') ? 'Jest winda — powiedz to, zanim klient zapyta o wchodzenie.' : floor ? 'Windy nie zaznaczono. Jeśli jej nie ma, powiedz to wprost.' : '',
  ].filter(Boolean);

  const roomSay = [
    roomsLabel
      ? `Przejdź pokoje w jednej kolejności, od wejścia. Jest ich ${roomsLabel} — nie skacz między nimi.`
      : 'Przejdź pomieszczenia w jednej kolejności, od wejścia.',
    areaLabel ? `Całość ma ${areaLabel}. Przy każdym pokoju powiedz, do czego służy, nie recytuj metrażu dwa razy.` : '',
    description ? `Z opisu weź jedno zdanie i tylko jedno: ${description}` : '',
  ].filter(Boolean);

  const techSay = [
    heating ? `Ogrzewanie: ${heating}.` : 'Ogrzewanie podaj tylko, jeśli jesteś pewien — nie zgaduj.',
    fee ? `Czynsz administracyjny: ${fee}.` : '',
    condition ? `Stan: ${condition}. Nie zmiękczaj tego słowa.` : '',
    amenities.length ? `Wypowiedz udogodnienia jednym zdaniem: ${amenities.join(', ')}.` : '',
  ].filter(Boolean);

  const closeSay = [
    'Na końcu nie pytaj „i jak?”. Zapytaj, co w tym mieszkaniu najbardziej pasuje, a co nie.',
    'Dopiero potem wróć do iPada i zapisz jedną z trzech odpowiedzi: interesuje, potrzebuje czasu, szuka czegoś innego.',
  ];

  const specs: BriefSpec[] = [
    { label: 'Adres', value: address },
    price ? { label: 'Cena', value: price } : null,
    perSqm ? { label: 'Cena za m²', value: perSqm } : null,
    areaLabel ? { label: 'Metraż', value: areaLabel } : null,
    roomsLabel ? { label: 'Pokoje', value: roomsLabel } : null,
    floor ? { label: 'Piętro', value: floor } : null,
    year ? { label: 'Rok budowy', value: year } : null,
    heating ? { label: 'Ogrzewanie', value: heating } : null,
    fee ? { label: 'Czynsz', value: fee } : null,
    condition ? { label: 'Stan', value: condition } : null,
    { label: 'Typ', value: `${kind} · ${deal}` },
    amenities.length ? { label: 'Udogodnienia', value: amenities.join(', ') } : null,
  ].filter((item): item is BriefSpec => Boolean(item));

  return {
    headline: title,
    address,
    stages: [
      {
        step: '01',
        title: 'Zanim wejdziecie',
        say: opener,
        watch: ['Klient ma w ręku ofertówkę albo link. Nie zaczynaj, dopóki nie widzi ceny i adresu.'],
      },
      {
        step: '02',
        title: 'Wejście',
        say: entranceSay,
        watch: ['Zwróć uwagę na klatkę, drzwi i pierwsze światło. Tego nie ma na zdjęciach.'],
      },
      {
        step: '03',
        title: 'Pomieszczenia',
        say: roomSay,
        watch: ['Idź wolno. Jedno pomieszczenie, jedno zdanie, potem cisza na pytanie.'],
      },
      {
        step: '04',
        title: 'Parametry, które trzeba powiedzieć',
        say: techSay.length ? techSay : ['Jeśli parametru nie ma na kartce, nie wymyślaj go.'],
        watch: ['Liczby mów raz. Potem pokaż je na ofertówce, zamiast powtarzać.'],
      },
      {
        step: '05',
        title: 'Zamknięcie pokazu',
        say: closeSay,
        watch: ['Nie składaj obietnic o cenie ani o umowie. To jest oglądanie, nie transakcja.'],
      },
    ],
    specs,
  };
}
