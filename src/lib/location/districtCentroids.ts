/**
 * Przybliżone środki dzielnic wszystkich miast z katalogiem (STRICT_CITY_DISTRICTS).
 * Ostatnia deska ratunku przy wykrywaniu dzielnicy z pinezki — gdy Mapbox nie poda nazwy,
 * wybieramy najbliższy środek. Każda dzielnica z katalogu musi mieć tu wpis.
 */
export const DISTRICT_CENTROIDS: Record<string, Record<string, [number, number]>> = {
  Warszawa: {
    Bemowo: [52.254, 20.91], Białołęka: [52.33, 21.04], Bielany: [52.29, 20.94], Mokotów: [52.193, 21.029],
    Ochota: [52.211, 20.985], "Praga-Południe": [52.247, 21.09], "Praga-Północ": [52.26, 21.04], Rembertów: [52.265, 21.19],
    Śródmieście: [52.231, 21.012], Targówek: [52.295, 21.045], Ursus: [52.196, 20.886], Ursynów: [52.14, 21.045],
    Wawer: [52.215, 21.183], Wesoła: [52.247, 21.23], Wilanów: [52.166, 21.09], Włochy: [52.196, 20.945],
    Wola: [52.236, 20.958], Żoliborz: [52.273, 20.984],
  },
  Kraków: {
    "Stare Miasto": [50.0614, 19.9366], Grzegórzki: [50.0583, 19.9583], "Prądnik Czerwony": [50.0883, 19.9692],
    "Prądnik Biały": [50.0933, 19.93], Krowodrza: [50.0733, 19.9183], Bronowice: [50.0817, 19.8833],
    Zwierzyniec: [50.0533, 19.8833], Dębniki: [50.035, 19.91], "Łagiewniki-Borek Fałęcki": [50.0183, 19.9317],
    Swoszowice: [49.9883, 19.9383], "Podgórze Duchackie": [50.0167, 19.9617], "Bieżanów-Prokocim": [50.0167, 20.005],
    Podgórze: [50.035, 19.9617], Czyżyny: [50.0733, 20.005], Mistrzejowice: [50.0967, 20.0133],
    Bieńczyce: [50.0867, 20.0267], "Wzgórza Krzesławickie": [50.0983, 20.065], "Nowa Huta": [50.0717, 20.0383],
  },
  Wrocław: {
    "Stare Miasto": [51.11, 17.032], Śródmieście: [51.12, 17.06], Krzyki: [51.075, 17.01], Fabryczna: [51.12, 16.94],
    "Psie Pole": [51.15, 17.1],
  },
  Poznań: {
    "Stare Miasto": [52.425, 16.935], "Nowe Miasto": [52.395, 17.0], Jeżyce: [52.42, 16.88], Grunwald: [52.39, 16.865],
    Wilda: [52.38, 16.92],
  },
  Łódź: {
    Bałuty: [51.805, 19.43], Górna: [51.72, 19.475], Polesie: [51.76, 19.4], Śródmieście: [51.77, 19.46], Widzew: [51.76, 19.53],
  },
  Lublin: {
    Śródmieście: [51.248, 22.56], "Czechów Północny": [51.28, 22.555], "Czechów Południowy": [51.265, 22.555],
    "Czuby Północne": [51.23, 22.525], "Czuby Południowe": [51.218, 22.525], LSM: [51.24, 22.53], Rury: [51.23, 22.545],
    Kalinowszczyzna: [51.255, 22.59], Tatary: [51.255, 22.61], Bronowice: [51.238, 22.595], Dziesiąta: [51.225, 22.565],
    Wrotków: [51.215, 22.545], Sławinek: [51.255, 22.51], Sławin: [51.27, 22.525], "Węglin Północny": [51.235, 22.49],
    "Węglin Południowy": [51.22, 22.495], Ponikwoda: [51.27, 22.61], "Hajdów-Zadębie": [51.265, 22.64],
    "Za Cukrownią": [51.24, 22.575], Abramowice: [51.2, 22.58],
  },
  Gdańsk: {
    Śródmieście: [54.35, 18.645], "Wrzeszcz Górny": [54.375, 18.605], "Wrzeszcz Dolny": [54.385, 18.615], Oliwa: [54.41, 18.56],
    "Przymorze Małe": [54.41, 18.605], "Przymorze Wielkie": [54.405, 18.59], "Zaspa-Młyniec": [54.395, 18.595],
    "Zaspa-Rozstaje": [54.39, 18.61], Jasień: [54.338, 18.57], Chełm: [54.335, 18.625], "Ujeścisko-Łostowice": [54.32, 18.59],
    "Piecki-Migowo": [54.37, 18.575], Osowa: [54.425, 18.47], Brzeźno: [54.405, 18.63], "Nowy Port": [54.405, 18.665],
    "Orunia-Św. Wojciech-Lipce": [54.32, 18.64], Stogi: [54.37, 18.71], "Żabianka-Wejhera-Jelitkowo-Tysiąclecia": [54.425, 18.59],
  },
  Gdynia: {
    Śródmieście: [54.518, 18.54], Orłowo: [54.48, 18.555], Redłowo: [54.495, 18.535], "Wzgórze Św. Maksymiliana": [54.505, 18.525],
    "Działki Leśne": [54.525, 18.525], Grabówek: [54.53, 18.505], Chylonia: [54.54, 18.465], Oksywie: [54.55, 18.53],
    Obłuże: [54.555, 18.52], Karwiny: [54.475, 18.49], Dąbrowa: [54.475, 18.465], "Wielki Kack": [54.47, 18.515],
    "Mały Kack": [54.485, 18.525], Pogórze: [54.56, 18.49], Cisowa: [54.55, 18.45], Leszczynki: [54.53, 18.485],
  },
  Sopot: {
    "Dolny Sopot": [54.445, 18.57], "Górny Sopot": [54.44, 18.55], "Kamienny Potok": [54.46, 18.555], Brodwino: [54.43, 18.53],
    Karlikowo: [54.435, 18.575], Przylesie: [54.45, 18.54], "Sopot Wyścigi": [54.425, 18.58],
  },
  Katowice: {
    Śródmieście: [50.26, 19.02], Załęże: [50.265, 18.99], "Załęska Hałda-Brynów": [50.245, 18.98], "Osiedle Tysiąclecia": [50.28, 18.99],
    Koszutka: [50.27, 19.03], Bogucice: [50.265, 19.05], Dąb: [50.28, 19.01], "Ligota-Panewniki": [50.225, 18.96],
    "Piotrowice-Ochojec": [50.205, 18.99], Giszowiec: [50.225, 19.08], "Szopienice-Burowiec": [50.265, 19.105],
    Murcki: [50.19, 19.05], "Wełnowiec-Józefowiec": [50.285, 19.03], "Janów-Nikiszowiec": [50.25, 19.09],
  },
  Rybnik: {
    Śródmieście: [50.097, 18.542], "Boguszowice Osiedle": [50.048, 18.5], "Boguszowice Stare": [50.04, 18.48],
    Chwałęcice: [50.165, 18.49], Chwałowice: [50.06, 18.555], Golejów: [50.035, 18.505], Gotartowice: [50.045, 18.53],
    Kamień: [50.11, 18.62], Kłokocin: [50.075, 18.515], "Ligota-Ligocka Kuźnia": [50.11, 18.545], Meksyk: [50.085, 18.56],
    Niedobczyce: [50.07, 18.47], Niewiadom: [50.075, 18.44], Ochojec: [50.14, 18.56], Orzepowice: [50.08, 18.53],
    "Paruszowiec-Piaski": [50.105, 18.515], Popielów: [50.06, 18.48], Radziejów: [50.065, 18.495],
    "Rybnicka Kuźnia": [50.115, 18.525], Smolna: [50.09, 18.555], Stodoły: [50.165, 18.52], Wielopole: [50.125, 18.6],
    Zamysłów: [50.095, 18.505], Zebrzydowice: [50.08, 18.61],
  },
  Białystok: {
    Centrum: [53.132, 23.16], Białostoczek: [53.15, 23.165], Bojary: [53.135, 23.175], "Dziesięciny I": [53.16, 23.145],
    "Dziesięciny II": [53.165, 23.155], Antoniuk: [53.145, 23.145], Piaski: [53.125, 23.17], Przydworcowe: [53.13, 23.135],
    Sienkiewicza: [53.14, 23.165], Młodych: [53.135, 23.125], Starosielce: [53.13, 23.08], "Nowe Miasto": [53.11, 23.15],
    "Wysoki Stoczek": [53.16, 23.13], "Zielone Wzgórza": [53.115, 23.125], "Słoneczny Stok": [53.15, 23.125],
    "Leśna Dolina": [53.155, 23.115], Bacieczki: [53.14, 23.105], Jaroszówka: [53.105, 23.13], Dojlidy: [53.115, 23.205],
    Skorupy: [53.125, 23.2], Zawady: [53.17, 23.14],
  },
  Zamość: {
    "Stare Miasto": [50.717, 23.252], "Nowe Miasto": [50.728, 23.256], Planty: [50.713, 23.265], Janowice: [50.73, 23.23],
    Karolówka: [50.735, 23.265], Promyk: [50.712, 23.24], Powiatowa: [50.72, 23.28], Rataja: [50.705, 23.255],
    Zamczysko: [50.74, 23.25], "Słoneczny Stok": [50.705, 23.275],
  },
};
