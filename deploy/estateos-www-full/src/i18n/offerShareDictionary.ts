import type { Locale } from "./config";

export type OfferShareDictionary = {
  cardLabel: string;
  area: string;
  rooms: string;
  floor: string;
  qrLabel: string;
  qrCaption: string;
  whyTitle: string;
};

const pl: OfferShareDictionary = {
  cardLabel: "Wizytówka oferty",
  area: "Metraż",
  rooms: "Pokoje",
  floor: "Piętro",
  qrLabel: "Kod QR oferty",
  qrCaption: "Zeskanuj telefonem — otworzy wizytówkę lub aplikację EstateOS™ z tą nieruchomością.",
  whyTitle: "Dlaczego EstateOS™?",
};

const en: OfferShareDictionary = {
  ...pl,
  cardLabel: "Listing card",
  area: "Area",
  rooms: "Rooms",
  floor: "Floor",
  qrLabel: "Listing QR code",
  qrCaption: "Scan with your phone — opens the card or EstateOS™ app with this property.",
  whyTitle: "Why EstateOS™?",
};

const uk: OfferShareDictionary = {
  ...en,
  cardLabel: "Візитівка оголошення",
  area: "Площа",
  rooms: "Кімнати",
  floor: "Поверх",
  qrLabel: "QR-код оголошення",
  qrCaption: "Відскануйте телефоном — відкриє візитівку або застосунок EstateOS™ з цією нерухомістю.",
  whyTitle: "Чому EstateOS™?",
};

export function getOfferShareDictionary(locale: Locale): OfferShareDictionary {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
