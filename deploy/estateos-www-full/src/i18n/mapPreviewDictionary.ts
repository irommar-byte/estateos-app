import type { Locale } from "./config";

export type MapPreviewDictionary = {
  sectionExact: string;
  sectionArea: string;
  footerPin: string;
  footerArea: string;
  mapTokenMissing: string;
  externalMaps: string;
  streetView: string;
};

const pl: MapPreviewDictionary = {
  sectionExact: "Podgląd lokalizacji (Mapbox)",
  sectionArea: "Okolica nieruchomości",
  footerPin:
    "Widok satelitarny z modelem 3D budynków i pinezką w miejscu wskazanym na mapie.",
  footerArea:
    "Widok okolicy bez dokładnej pinezki — pokazuje charakter rejonu, nie precyzyjny adres.",
  mapTokenMissing: "Brak NEXT_PUBLIC_MAPBOX_TOKEN — mapa podglądowa niedostępna.",
  externalMaps: "Google Maps",
  streetView: "Street View",
};

const en: MapPreviewDictionary = {
  sectionExact: "Location preview (Mapbox)",
  sectionArea: "Neighborhood",
  footerPin: "Satellite view with 3D buildings and a map pin at the listed location.",
  footerArea: "Area preview without an exact pin — shows the character of the neighborhood.",
  mapTokenMissing: "Mapbox token missing — preview map unavailable.",
  externalMaps: "Google Maps",
  streetView: "Street View",
};

const uk: MapPreviewDictionary = {
  sectionExact: "Попередній перегляд локації (Mapbox)",
  sectionArea: "Околиці нерухомості",
  footerPin:
    "Супутниковий вигляд із 3D-моделлю будівель і маркером у вказаному місці на карті.",
  footerArea:
    "Огляд околиці без точної позначки — показує характер району, а не точну адресу.",
  mapTokenMissing: "Відсутній NEXT_PUBLIC_MAPBOX_TOKEN — карта попереднього перегляду недоступна.",
  externalMaps: "Google Maps",
  streetView: "Street View",
};

export function getMapPreviewDictionary(locale: Locale): MapPreviewDictionary {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
