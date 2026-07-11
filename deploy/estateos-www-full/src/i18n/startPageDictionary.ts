import type { Locale } from "./config";
import { ESTATEOS_PUBLIC_URLS } from "@/lib/estateOsPublicFacts";

export type StartPageCard = {
  href: string;
  title: string;
  body: string;
  cta: string;
};

export type StartPageDictionary = {
  heroBadge: string;
  heroTitle: string;
  heroTitleAccent: string;
  heroSubtitle: string;
  cards: StartPageCard[];
  appSectionLabel: string;
  appSectionBody: string;
  campaignFooter: string;
  pressLink: string;
};

const pl: StartPageDictionary = {
  heroBadge: "EstateOS™",
  heroTitle: "Rynek nieruchomości.",
  heroTitleAccent: "Jedna platforma. Mapa + app + CRM.",
  heroSubtitle:
    "Mapa ofert, Radar dopasowań, CRM dla agencji i aplikacja mobilna — w jednym ekosystemie EstateOS™.",
  cards: [
    {
      href: ESTATEOS_PUBLIC_URLS.agencies,
      title: "Jestem agentem / agencją",
      body: "CRM, import z OtoDom i OLX, udostępnianie ofert z podglądem, wizyty i Radar klientów.",
      cta: "Dla agencji",
    },
    {
      href: ESTATEOS_PUBLIC_URLS.private,
      title: "Szukam lub sprzedaję mieszkanie",
      body: "Mapa ofert, Radar dopasowań, ulubione i bezpieczny kontakt z właścicielami oraz agentami.",
      cta: "Dla osób prywatnych",
    },
    {
      href: ESTATEOS_PUBLIC_URLS.join,
      title: "Mam ogłoszenie na innym portalu",
      body: "Wklej link z OtoDom lub OLX — przeniesiemy ofertę na mapę EstateOS w kilka minut.",
      cta: "Import ogłoszenia",
    },
  ],
  appSectionLabel: "Aplikacja mobilna",
  appSectionBody:
    "Pobierz EstateOS na iPhone lub Androida — powiadomienia, mapa, wiadomości i oferty zawsze pod ręką.",
  campaignFooter: "Udostępniasz kampanię? Używaj linków z parametrami UTM — śledzimy źródło ruchu.",
  pressLink: "Materiały prasowe",
};

const en: StartPageDictionary = {
  heroBadge: "EstateOS™",
  heroTitle: "Real estate market.",
  heroTitleAccent: "One platform. Map + app + CRM.",
  heroSubtitle:
    "Listing map, match Radar, agency CRM, and mobile app — in one EstateOS™ ecosystem.",
  cards: [
    {
      href: ESTATEOS_PUBLIC_URLS.agencies,
      title: "I'm an agent / agency",
      body: "CRM, OtoDom & OLX import, shareable listings, viewings, and client Radar.",
      cta: "For agencies",
    },
    {
      href: ESTATEOS_PUBLIC_URLS.private,
      title: "I'm buying or selling a home",
      body: "Listing map, match Radar, favorites, and safe contact with owners and agents.",
      cta: "For private users",
    },
    {
      href: ESTATEOS_PUBLIC_URLS.join,
      title: "I have a listing on another portal",
      body: "Paste an OtoDom or OLX link — we'll move the listing to EstateOS in minutes.",
      cta: "Import listing",
    },
  ],
  appSectionLabel: "Mobile app",
  appSectionBody:
    "Get EstateOS on iPhone or Android — notifications, map, messages, and listings on the go.",
  campaignFooter: "Sharing the campaign? Use UTM links — we track traffic sources.",
  pressLink: "Press materials",
};

const uk: StartPageDictionary = {
  heroBadge: "EstateOS™",
  heroTitle: "Ринок нерухомості.",
  heroTitleAccent: "Одна платформа. Карта + застосунок + CRM.",
  heroSubtitle:
    "Карта оголошень, Radar підбору, CRM для агентств і мобільний застосунок — в одній екосистемі EstateOS™.",
  cards: [
    {
      href: ESTATEOS_PUBLIC_URLS.agencies,
      title: "Я агент / агентство",
      body: "CRM, імпорт з OtoDom та OLX, шеринг оголошень, візити та Radar клієнтів.",
      cta: "Для агентств",
    },
    {
      href: ESTATEOS_PUBLIC_URLS.private,
      title: "Шукаю або продаю житло",
      body: "Карта оголошень, Radar підбору, обране та безпечний контакт із власниками й агентами.",
      cta: "Для приватних осіб",
    },
    {
      href: ESTATEOS_PUBLIC_URLS.join,
      title: "Маю оголошення на іншому порталі",
      body: "Вставте посилання з OtoDom або OLX — перенесемо оголошення на карту EstateOS за кілька хвилин.",
      cta: "Імпорт оголошення",
    },
  ],
  appSectionLabel: "Мобільний застосунок",
  appSectionBody:
    "Завантажте EstateOS на iPhone або Android — сповіщення, карта, повідомлення та оголошення завжди під рукою.",
  campaignFooter: "Поширюєте кампанію? Використовуйте UTM-посилання — ми відстежуємо джерела трафіку.",
  pressLink: "Матеріали для преси",
};

export function getStartPageDictionary(locale: Locale): StartPageDictionary {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
