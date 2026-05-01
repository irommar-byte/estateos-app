/**
 * Etykiety dzielnic (STRICT_CITY_DISTRICTS) → klucze w DISTRICT_COORDS w Step2_Location,
 * gdy w tabeli współrzędnych użyto innej nazwy (Trójmiasto, suffiksy WRO/POZ/ZAM itd.).
 * Zapobiega błędnemu dopasowaniu (np. „Śródmieście” łapane jako Warszawa zamiast Łodzi).
 */
export const DISTRICT_LABEL_TO_COORD_KEY: Record<string, Record<string, string>> = {
  Gdańsk: {
    Śródmieście: 'Gdańsk - Śródmieście',
    'Wrzeszcz Górny': 'Gdańsk - Wrzeszcz',
    'Wrzeszcz Dolny': 'Gdańsk - Wrzeszcz',
    Oliwa: 'Gdańsk - Oliwa',
    'Przymorze Małe': 'Gdańsk - Przymorze',
    'Przymorze Wielkie': 'Gdańsk - Przymorze',
    'Zaspa-Młyniec': 'Gdańsk - Zaspa',
    'Zaspa-Rozstaje': 'Gdańsk - Zaspa',
    Jasień: 'Gdańsk - Jasień',
    Chełm: 'Gdańsk - Chełm',
    'Ujeścisko-Łostowice': 'Gdańsk - Jasień',
    'Piecki-Migowo': 'Gdańsk - Przymorze',
    Osowa: 'Gdańsk - Osowa',
    Brzeźno: 'Gdańsk - Śródmieście',
    'Nowy Port': 'Gdańsk - Śródmieście',
    'Orunia-Św. Wojciech-Lipce': 'Gdańsk - Chełm',
    Stogi: 'Gdańsk - Chełm',
    'Żabianka-Wejhera-Jelitkowo-Tysiąclecia': 'Gdańsk - Zaspa',
  },
  Gdynia: {
    Śródmieście: 'Gdynia - Śródmieście',
    Orłowo: 'Gdynia - Orłowo',
    Redłowo: 'Gdynia - Redłowo',
    'Wzgórze Św. Maksymiliana': 'Gdynia - Śródmieście',
    'Działki Leśne': 'Gdynia - Chylonia',
    Grabówek: 'Gdynia - Chylonia',
    Chylonia: 'Gdynia - Chylonia',
    Oksywie: 'Gdynia - Chylonia',
    Obłuże: 'Gdynia - Chylonia',
    Karwiny: 'Gdynia - Redłowo',
    Dąbrowa: 'Gdynia - Redłowo',
    'Wielki Kack': 'Gdynia - Chylonia',
    'Mały Kack': 'Gdynia - Wielki Kack',
    Pogórze: 'Gdynia - Chylonia',
    Cisowa: 'Gdynia - Chylonia',
    Leszczynki: 'Gdynia - Chylonia',
  },
  Sopot: {
    'Dolny Sopot': 'Sopot - Dolny',
    'Górny Sopot': 'Sopot - Górny',
    'Kamienny Potok': 'Sopot - Górny',
    Brodwino: 'Sopot - Górny',
    Karlikowo: 'Sopot - Dolny',
    Przylesie: 'Sopot - Górny',
    'Sopot Wyścigi': 'Sopot - Dolny',
  },
  Wrocław: {
    'Stare Miasto': 'Stare Miasto WRO',
    Śródmieście: 'Śródmieście WRO',
  },
  Poznań: {
    'Stare Miasto': 'Stare Miasto POZ',
    'Nowe Miasto': 'Nowe Miasto POZ',
  },
  Łódź: {
    Śródmieście: 'Łódź',
  },
  Lublin: {
    Śródmieście: 'Śródmieście LUB',
    'Czechów Północny': 'Czechów',
    'Czechów Południowy': 'Czechów',
  },
  Zamość: {
    'Stare Miasto': 'Stare Miasto ZAM',
    'Nowe Miasto': 'Nowe Miasto ZAM',
    Planty: 'Planty ZAM',
  },
};

export function coordKeyForCityDistrict(city: string, district: string): string {
  return DISTRICT_LABEL_TO_COORD_KEY[city]?.[district] ?? district;
}
