import type { Locale } from './config';

export type PortalImportProfileGuideDictionary = {
  stepOf: (current: number, total: number) => string;
  later: string;
  next: string;
  finish: string;
  pendingBadge: string;
  pendingTitle: string;
  pendingBody: (offerId: number) => string;
  pendingHint: string;
  investorBadgeApp: string;
  investorBadgeWeb: string;
  investorTitle: string;
  investorBodyApp: string;
  investorBodyWeb: string;
  investorCredits: string;
  investorPriceNoteApp: string;
  investorPriceNoteWeb: string;
  investorCta: string;
  investorCtaWeb: string;
  investorAppTrialHint: string;
  investorLater: string;
  searchTitle: string;
  searchBody: string;
  searchYes: string;
  searchNo: string;
  radarTitle: string;
  radarSteps: string[];
  radarCta: string;
  appTitle: string;
  appBody: string;
  appIos: string;
  appAndroid: string;
  panelTitle: string;
  panelTips: Array<{ label: string; href: string; hint: string }>;
};

const pl: PortalImportProfileGuideDictionary = {
  stepOf: (c, t) => `Krok ${c} z ${t}`,
  later: 'Później',
  next: 'Dalej',
  finish: 'Rozumiem — przejdź do profilu',
  pendingBadge: 'Oczekuje na weryfikację',
  pendingTitle: 'Ogłoszenie jest na Twoim profilu',
  pendingBody: (id) =>
    `Zaimportowaliśmy ofertę #${id} wraz ze zdjęciami i oryginalnym opisem z portalu. Zespół EstateOS™ sprawdzi ją przed publikacją na mapie — dostaniesz powiadomienie, gdy będzie aktywna.`,
  pendingHint: 'Status „Oczekujące” zobaczysz w panelu Moje konto → CRM.',
  investorBadgeApp: '3 dni za darmo',
  investorBadgeWeb: '249 zł / 30 dni',
  investorTitle: 'Wypróbuj Investor Pro',
  investorBodyApp:
    'Import z portali, podgląd off-market i narzędzia premium — w aplikacji masz 3 dni za darmo. Anuluj w App Store lub Google Play przed końcem trialu, jeśli nie chcesz płacić.',
  investorBodyWeb:
    'Import z portali, podgląd off-market i Radar bez 24-godzinnego opóźnienia. Na stronie www aktywujesz Investor Pro jednorazową płatnością — bez okresu próbnego.',
  investorCredits: '5 publikacji w pakiecie + Radar bez 24-godzinnego opóźnienia.',
  investorPriceNoteApp: 'Po trialu — subskrypcja miesięczna w sklepie z aplikacjami.',
  investorPriceNoteWeb: 'Płatność od razu (karta lub BLIK w Stripe). Po 30 dniach przedłużysz pakiet na cenniku.',
  investorCta: 'Rozpocznij 3-dniowy trial w aplikacji',
  investorCtaWeb: 'Kup Investor Pro — 249 zł',
  investorAppTrialHint: 'Na iPhone i Android: 3-dniowy trial w App Store / Google Play',
  investorLater: 'Później',
  searchTitle: 'Szukasz też nieruchomości dla siebie?',
  searchBody:
    'Wielu właścicieli korzysta z EstateOS™ także jako kupujący. Ustaw Radar — dostaniesz powiadomienie, gdy pojawi się idealna oferta.',
  searchYes: 'Tak, chcę ustawić Radar',
  searchNo: 'Nie, tylko sprzedaję',
  radarTitle: 'Jak ustawić Radar w 3 krokach',
  radarSteps: [
    'Pobierz aplikację EstateOS™ lub wejdź w Moje konto → CRM → zakładka Radar.',
    'Wybierz miasto, budżet, metraż i typ transakcji — tak jak szukasz w głowie.',
    'Zapisz — system skanuje rynek i powiadamia Cię o dopasowaniach na żywo.',
  ],
  radarCta: 'Otwórz kalibrację Radaru',
  appTitle: 'Pobierz aplikację — szybciej ogarniesz panel',
  appBody:
    'W aplikacji masz mapę, Radar, wiadomości i powiadomienia push. To najwygodniejszy sposób na kontakt z kupującymi.',
  appIos: 'App Store',
  appAndroid: 'Google Play',
  panelTitle: 'Gdzie co kliknąć na stronie',
  panelTips: [
    { label: 'Moje konto → CRM', href: '/moje-konto/crm', hint: 'Twoje ogłoszenia i status weryfikacji' },
    { label: 'Mapa', href: '/odkryj-mape', hint: 'Podgląd rynku po aktywacji oferty' },
    { label: 'Wiadomości', href: '/moje-konto/wiadomosci', hint: 'Kontakt z zainteresowanymi' },
    { label: 'Edytuj ofertę', href: '/moje-konto/crm', hint: 'Doprecyzuj dane przed publikacją' },
  ],
};

const en: PortalImportProfileGuideDictionary = {
  ...pl,
  stepOf: (c, t) => `Step ${c} of ${t}`,
  later: 'Later',
  next: 'Continue',
  finish: 'Got it — go to profile',
  pendingBadge: 'Awaiting review',
  pendingTitle: 'Your listing is on your profile',
  pendingBody: (id) =>
    `We imported listing #${id} with photos and the original portal description. The EstateOS™ team will review it before it goes live on the map.`,
  pendingHint: 'See “Pending” status under My account → CRM.',
  investorBadgeApp: '3 days free',
  investorBadgeWeb: '249 PLN / 30 days',
  investorTitle: 'Try Investor Pro',
  investorBodyApp:
    'Portal import, off-market preview and premium tools — 3 days free in the app. Cancel in the App Store or Google Play before the trial ends if you do not want to pay.',
  investorBodyWeb:
    'Portal import, off-market preview and Radar without the 24-hour delay. On the website you activate Investor Pro with a one-time payment — no free trial.',
  investorCredits: '5 publication credits + Radar without the 24-hour delay.',
  investorPriceNoteApp: 'After the trial — monthly subscription in the app store.',
  investorPriceNoteWeb: 'Pay immediately (card or BLIK via Stripe). Renew on the pricing page after 30 days.',
  investorCta: 'Start 3-day trial in the app',
  investorCtaWeb: 'Buy Investor Pro — 249 PLN',
  investorAppTrialHint: 'On iPhone and Android: 3-day trial in the App Store / Google Play',
  investorLater: 'Later',
  searchTitle: 'Also looking for a property?',
  searchBody: 'Many owners use EstateOS™ as buyers too. Set up Radar to get notified when a perfect match appears.',
  searchYes: 'Yes, set up Radar',
  searchNo: 'No, I am only selling',
  radarTitle: 'Set up Radar in 3 steps',
  radarSteps: [
    'Get the EstateOS™ app or open My account → CRM → Radar tab.',
    'Pick city, budget, area and transaction type.',
    'Save — the system scans the market and notifies you live.',
  ],
  radarCta: 'Open Radar calibration',
  appTitle: 'Get the app — navigate faster',
  appBody: 'Map, Radar, messages and push notifications — the easiest way to reach buyers.',
  appIos: 'App Store',
  appAndroid: 'Google Play',
  panelTitle: 'Where to click on the website',
  panelTips: [
    { label: 'My account → CRM', href: '/moje-konto/crm', hint: 'Your listings and review status' },
    { label: 'Map', href: '/odkryj-mape', hint: 'Market preview after activation' },
    { label: 'Messages', href: '/moje-konto/wiadomosci', hint: 'Contact interested buyers' },
    { label: 'Edit listing', href: '/moje-konto/crm', hint: 'Refine details before going live' },
  ],
};

const uk: PortalImportProfileGuideDictionary = {
  ...en,
  pendingTitle: 'Оголошення на вашому профілі',
  investorBadgeApp: '3 дні безкоштовно',
  investorBadgeWeb: '249 zł / 30 дн.',
  investorTitle: 'Спробуйте Investor Pro',
  investorBodyApp:
    'Імпорт з порталів, off-market і преміум-інструменти — 3 дні безкоштовно в застосунку. Скасуйте в App Store або Google Play до кінця trial, якщо не хочете платити.',
  investorBodyWeb:
    'Імпорт з порталів, off-market і Radar без 24-годинної затримки. На сайті Investor Pro — одноразова оплата, без пробного періоду.',
  investorPriceNoteWeb: 'Оплата одразу (картка або BLIK у Stripe). Після 30 днів — продовження на сторінці цін.',
  investorCta: 'Розпочати 3-денний trial у застосунку',
  investorCtaWeb: 'Купити Investor Pro — 249 zł',
  investorAppTrialHint: 'На iPhone та Android: 3-денний trial у App Store / Google Play',
  searchTitle: 'Також шукаєте нерухомість для себе?',
  radarTitle: 'Як налаштувати Radar за 3 кроки',
  finish: 'Зрозуміло — до профілю',
};

const MAP: Record<Locale, PortalImportProfileGuideDictionary> = { pl, en, uk };

export function getPortalImportProfileGuideDict(locale: Locale): PortalImportProfileGuideDictionary {
  return MAP[locale] ?? pl;
}
