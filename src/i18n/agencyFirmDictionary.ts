import type { Locale } from './config';
import { numberFormatLocale } from './config';

export type AgencyFirmDictionary = {
  backToCrm: string;
  adminPanel: string;
  publicOfficePage: string;
  website: string;
  teamTitle: string;
  teamSubtitle: string;
  pendingTitle: string;
  pendingSubtitle: string;
  approve: string;
  reject: string;
  administrator: string;
  agent: string;
  lastLogin: string;
  offers: string;
  reviews: string;
  transactions: string;
  credits: string;
  actions: string;
  position: string;
  manage: string;
  profile: string;
  assignCredits: string;
  suspend: string;
  restore: string;
  removeFromOffice: string;
  suspendedTitle: string;
  suspendedSubtitle: string;
  confirmSuspendTitle: string;
  confirmSuspendBody: string;
  confirmRemoveTitle: string;
  confirmRemoveBody: string;
  confirm: string;
  cancel: string;
  activeOffersShort: string;
  pendingOffersShort: string;
  soldOffersShort: string;
  recentOffersTitle: string;
  assignToAgent: string;
  transfer: string;
  noCompanyData: string;
  noCompanyDataHint: string;
  awaitingApprovalTitle: string;
  awaitingApprovalBody: string;
  awaitingStatus: string;
  yourOffice: string;
  employeeOnlyHint: string;
  goToCrm: string;
  contactSectionTitle: string;
  contactSectionHint: string;
  edit: string;
  creditsPool: string;
  team: string;
  activeAgents: string;
  pendingAgents: string;
  companyOffers: string;
  creditsInPool: string;
  connectionError: string;
  operationFailed: string;
  agentTitles: Record<string, string>;
  partnerPlan: {
    activePackage: string;
    trialBadge: string;
    proTrialBadge: string;
    freePeriodBadge: string;
    activePool: string;
    upgradePackage: string;
    validUntil: (date: string, days: string) => string;
    freePeriodNote: (periodDays: number) => string;
    freePlanNote: string;
    proTrialNote: (price: number, periodDays: number) => string;
    paidRenewalNote: (price: number, periodDays: number) => string;
    creditsPoolLabel: string;
    teamLabel: string;
    agencyPackage: string;
    upgradeSubscription: string;
    choosePaidPackage: string;
    upgradeDiffNote: string;
    freeUpgradeNote: string;
    ecosystemNote: string;
    backToActive: string;
    noActivePool: string;
    noActivePoolHint: string;
    highestPackage: string;
    recommended: string;
    perkOfficePro: string;
    perkReports: string;
    perkMarket: string;
    perkStartGap: string;
    per30Days: string;
    creditsOnPool: (n: number) => string;
    agentsInTeam: (label: string) => string;
    whatChanges: (planName: string) => string;
    trialCheckoutNote: (price: number, periodDays: number) => string;
    trialCta: string;
    upgradeCta: string;
    activateCta: string;
    planLabels: Record<string, string>;
    activePartnerPool: string;
  };
};

const pl: AgencyFirmDictionary = {
  backToCrm: 'Wróć do CRM',
  adminPanel: 'Panel administratora',
  publicOfficePage: 'Publiczna strona biura',
  website: 'Strona www',
  teamTitle: 'Zespół i aktywność',
  teamSubtitle: 'Logowania, oferty, CRM i przenoszenie ogłoszeń między agentami',
  pendingTitle: 'Zgłoszenia do zatwierdzenia',
  pendingSubtitle: 'Nowi agenci czekają na akceptację kierownika biura',
  approve: 'Zatwierdź',
  reject: 'Odrzuć',
  administrator: 'Administrator',
  agent: 'Agent',
  lastLogin: 'Ostatnie logowanie',
  offers: 'Oferty',
  reviews: 'Opinie',
  transactions: 'Transakcje',
  credits: 'Kredyty',
  actions: 'Akcje',
  position: 'Stanowisko',
  manage: 'Zarządzaj',
  profile: 'Profil',
  assignCredits: 'Kredyty',
  suspend: 'Zawieś',
  restore: 'Przywróć',
  removeFromOffice: 'Usuń z biura',
  suspendedTitle: 'Zawieszeni agenci',
  suspendedSubtitle: 'Dostęp do CRM i publikacji wstrzymany — możesz przywrócić lub usunąć z zespołu',
  confirmSuspendTitle: 'Zawiesić agenta?',
  confirmSuspendBody:
    'Agent utraci dostęp do CRM i publikacji w imieniu biura. Oferty pozostają w systemie — możesz je przenieść przed zawieszeniem.',
  confirmRemoveTitle: 'Usunąć agenta z biura?',
  confirmRemoveBody:
    'To trwałe rozłączenie z zespołem. Agent będzie musiał złożyć nowe zgłoszenie, aby dołączyć ponownie.',
  confirm: 'Potwierdź',
  cancel: 'Anuluj',
  activeOffersShort: 'aktyw.',
  pendingOffersShort: 'oczek.',
  soldOffersShort: 'sprzed.',
  recentOffersTitle: 'Ostatnie ogłoszenia biura',
  assignToAgent: 'Przypisz agentowi',
  transfer: 'Przenieś',
  noCompanyData: 'Brak danych biura',
  noCompanyDataHint: 'Nie udało się wczytać informacji o firmie. Odśwież stronę lub wróć do CRM.',
  awaitingApprovalTitle: 'Oczekujesz na zatwierdzenie',
  awaitingApprovalBody:
    'Twoje zgłoszenie do biura {company} zostało wysłane. Administrator firmy musi je zatwierdzić, zanim uzyskasz dostęp do CRM i publikacji ofert.',
  awaitingStatus: 'Status: oczekujący pracownik',
  yourOffice: 'Twoje biuro',
  employeeOnlyHint:
    'Jesteś aktywnym pracownikiem tego biura. Panel zarządzania firmą jest dostępny tylko dla administratora.',
  goToCrm: 'Przejdź do CRM',
  contactSectionTitle: 'Dane kontaktowe biura',
  contactSectionHint: 'Widoczne na publicznej stronie biura i w katalogu agencji',
  edit: 'Edytuj',
  creditsPool: 'Pula kredytów',
  team: 'Zespół',
  activeAgents: 'Aktywni agenci',
  pendingAgents: 'Oczekujący',
  companyOffers: 'Oferty firmy',
  creditsInPool: 'Kredyty w puli',
  connectionError: 'Błąd połączenia.',
  operationFailed: 'Operacja nie powiodła się.',
  agentTitles: {
    DORADCA: 'Doradca',
    AGENT: 'Agent',
    BROKER: 'Broker',
    EXPERT: 'Expert',
    LEADER: 'Leader',
    KIEROWNIK_BIURO: 'Kierownik biura',
    ZASTEPCA_KIEROWNIKA: 'Zastępca kierownika biura',
  },
  partnerPlan: {
    activePackage: 'Aktywny pakiet',
    trialBadge: 'Okres próbny',
    proTrialBadge: 'Trial Partner Pro · 30 dni',
    freePeriodBadge: 'Partner Free · 90 dni · 0 zł',
    activePool: 'Aktywna pula kredytów firmy.',
    upgradePackage: 'Ulepsz pakiet',
    validUntil: (date, days) => `Ważne do ${date}${days}`,
    freePeriodNote: (periodDays) =>
      ` Okres startowy ${periodDays} dni od rejestracji biura — zgodnie z Partner Free na cenniku. Bez karty, bez abonamentu.`,
    freePlanNote:
      ' Po wygaśnięciu możesz wybrać płatny pakiet dopasowany do zespołu — bez automatycznych opłat.',
    proTrialNote: (price, periodDays) =>
      ` Trial Partner Pro (${periodDays} dni) — po zakończeniu możesz kontynuować na planie Pro (${price} zł / ${periodDays} dni) lub wrócić do wyboru pakietu.`,
    paidRenewalNote: (price, periodDays) =>
      ` Abonament odnawia się co ${periodDays} dni (${price} zł) — zarządzasz subskrypcją w ustawieniach konta.`,
    creditsPoolLabel: 'Pula kredytów',
    teamLabel: 'Zespół',
    agencyPackage: 'Pakiet agencji',
    upgradeSubscription: 'Ulepsz abonament biura',
    choosePaidPackage: 'EstateOS™ Partner — wybierz pakiet',
    upgradeDiffNote:
      'Dopłać różnicę i od razu zyskujesz wyższy limit agentów oraz większą pulę kredytów.',
    freeUpgradeNote:
      'Masz aktywny Partner Free. Wybierz płatny pakiet, gdy potrzebujesz więcej kredytów lub miejsc w zespole.',
    ecosystemNote: 'Kredyty publikacji, limit zespołu i CRM w jednym miejscu.',
    backToActive: '← Wróć do aktywnego pakietu',
    noActivePool: 'Brak aktywnej puli',
    noActivePoolHint: 'Aktywuj płatny pakiet, aby odnowić kredyty firmy.',
    highestPackage: 'Masz już najwyższy pakiet Partner Enterprise.',
    recommended: 'Najchętniej wybierany',
    perkOfficePro:
      'Cały zespół dostaje status Pro: Off Market, Market na ofertach, taśmy w katalogu i tytanowe okienko',
    perkReports: '5 wygenerowań raportu wyceny na osobę / 30 dni. Wysyłka e-mail nie zużywa limitu.',
    perkMarket: 'Na każdej ofercie widać, jak daleko cena odbiega od transakcji notarialnych',
    perkStartGap: 'Bez Off Market, Market, taśm i raportów — to zalety Partner Pro',
    per30Days: 'zł / 30 dni',
    creditsOnPool: (n) => `${n} kredytów na pulę`,
    agentsInTeam: (label) => `${label} w zespole`,
    whatChanges: (planName) => `Co się zmieni — ${planName}`,
    trialCheckoutNote: (price, periodDays) =>
      `Płatny pakiet Pro: ${price} zł / ${periodDays} dni po ewentualnym trialu. Partner Free (90 dni) aktywuje się przy rejestracji biura.`,
    trialCta: 'Rozpocznij okres próbny',
    upgradeCta: 'Ulepsz pakiet',
    activateCta: 'Aktywuj pakiet',
    planLabels: {
      free: 'Partner Free',
      start: 'Partner Start',
      pro: 'Partner Pro',
      enterprise: 'Partner Enterprise',
    },
    activePartnerPool: 'Aktywna pula Partner',
  },
};

const en: AgencyFirmDictionary = {
  backToCrm: 'Back to CRM',
  adminPanel: 'Admin dashboard',
  publicOfficePage: 'Public office page',
  website: 'Website',
  teamTitle: 'Team & activity',
  teamSubtitle: 'Logins, listings, CRM and offer transfers between agents',
  pendingTitle: 'Pending approvals',
  pendingSubtitle: 'New agents awaiting office manager approval',
  approve: 'Approve',
  reject: 'Decline',
  administrator: 'Administrator',
  agent: 'Agent',
  lastLogin: 'Last login',
  offers: 'Listings',
  reviews: 'Reviews',
  transactions: 'Deals',
  credits: 'Credits',
  actions: 'Actions',
  position: 'Role',
  manage: 'Manage',
  profile: 'Profile',
  assignCredits: 'Credits',
  suspend: 'Suspend',
  restore: 'Restore',
  removeFromOffice: 'Remove',
  suspendedTitle: 'Suspended agents',
  suspendedSubtitle: 'CRM and publishing access paused — restore or remove from the team',
  confirmSuspendTitle: 'Suspend this agent?',
  confirmSuspendBody:
    'They will lose CRM and publishing access for the office. Listings remain — transfer them first if needed.',
  confirmRemoveTitle: 'Remove agent from office?',
  confirmRemoveBody:
    'This disconnects them from the team. They must submit a new request to rejoin.',
  confirm: 'Confirm',
  cancel: 'Cancel',
  activeOffersShort: 'active',
  pendingOffersShort: 'pending',
  soldOffersShort: 'sold',
  recentOffersTitle: 'Recent office listings',
  assignToAgent: 'Assign to agent',
  transfer: 'Transfer',
  noCompanyData: 'Office data unavailable',
  noCompanyDataHint: 'Could not load company information. Refresh or return to CRM.',
  awaitingApprovalTitle: 'Awaiting approval',
  awaitingApprovalBody:
    'Your request to join {company} was sent. An administrator must approve it before you can use CRM and publish listings.',
  awaitingStatus: 'Status: pending member',
  yourOffice: 'Your office',
  employeeOnlyHint: 'You are an active team member. Office management is available to administrators only.',
  goToCrm: 'Go to CRM',
  contactSectionTitle: 'Office contact details',
  contactSectionHint: 'Shown on the public office page and agency directory',
  edit: 'Edit',
  creditsPool: 'Credit pool',
  team: 'Team',
  activeAgents: 'Active agents',
  pendingAgents: 'Pending',
  companyOffers: 'Office listings',
  creditsInPool: 'Pool credits',
  connectionError: 'Connection error.',
  operationFailed: 'Operation failed.',
  agentTitles: {
    DORADCA: 'Advisor',
    AGENT: 'Agent',
    BROKER: 'Broker',
    EXPERT: 'Expert',
    LEADER: 'Leader',
    KIEROWNIK_BIURO: 'Office manager',
    ZASTEPCA_KIEROWNIKA: 'Deputy manager',
  },
  partnerPlan: {
    activePackage: 'Active plan',
    trialBadge: 'Trial period',
    proTrialBadge: 'Partner Pro trial · 30 days',
    freePeriodBadge: 'Partner Free · 90 days · 0 PLN',
    activePool: 'Company credit pool is active.',
    upgradePackage: 'Upgrade plan',
    validUntil: (date, days) => `Valid until ${date}${days}`,
    freePeriodNote: (periodDays) =>
      ` Starter period: ${periodDays} days from office registration — as on the pricing page. No card, no subscription.`,
    freePlanNote:
      ' After it ends you can choose a paid plan that fits your team — no automatic charges.',
    proTrialNote: (price, periodDays) =>
      ` Partner Pro trial (${periodDays} days) — after it ends you may continue on Pro (${price} PLN / ${periodDays} days) or pick another plan.`,
    paidRenewalNote: (price, periodDays) =>
      ` Subscription renews every ${periodDays} days (${price} PLN) — manage it in account settings.`,
    creditsPoolLabel: 'Credit pool',
    teamLabel: 'Team',
    agencyPackage: 'Agency plan',
    upgradeSubscription: 'Upgrade office subscription',
    choosePaidPackage: 'EstateOS™ Partner — choose a plan',
    upgradeDiffNote: 'Pay the difference to unlock more agent seats and a larger credit pool.',
    freeUpgradeNote: 'Partner Free is active. Choose a paid plan when you need more credits or seats.',
    ecosystemNote: 'Publication credits, team limits and CRM in one place.',
    backToActive: '← Back to active plan',
    noActivePool: 'No active pool',
    noActivePoolHint: 'Activate a paid plan to renew company credits.',
    highestPackage: 'You already have Partner Enterprise.',
    recommended: 'Most chosen',
    perkOfficePro:
      'The whole team gets Pro status: Off Market, Market on listings, catalog tapes and the titanium panel',
    perkReports: '5 valuation reports emailed to clients — per person / 30 days',
    perkMarket: 'Every listing shows how far the ask is from notarized transactions',
    perkStartGap: 'No Off Market, Market, tapes or reports — those are Partner Pro perks',
    per30Days: 'PLN / 30 days',
    creditsOnPool: (n) => `${n} credits for the pool`,
    agentsInTeam: (label) => `${label} on the team`,
    whatChanges: (planName) => `What changes — ${planName}`,
    trialCheckoutNote: (price, periodDays) =>
      `Paid Pro plan: ${price} PLN / ${periodDays} days after any trial. Partner Free (90 days) activates on office registration.`,
    trialCta: 'Start trial',
    upgradeCta: 'Upgrade plan',
    activateCta: 'Activate plan',
    planLabels: {
      free: 'Partner Free',
      start: 'Partner Start',
      pro: 'Partner Pro',
      enterprise: 'Partner Enterprise',
    },
    activePartnerPool: 'Active Partner pool',
  },
};

const uk: AgencyFirmDictionary = {
  ...en,
  backToCrm: 'Назад до CRM',
  adminPanel: 'Панель адміністратора',
  publicOfficePage: 'Публічна сторінка офісу',
  website: 'Веб-сайт',
  teamTitle: 'Команда та активність',
  teamSubtitle: 'Входи, оголошення, CRM і передача між агентами',
  pendingTitle: 'Заявки на підтвердження',
  pendingSubtitle: 'Нові агенти очікують схвалення керівника офісу',
  approve: 'Схвалити',
  reject: 'Відхилити',
  administrator: 'Адміністратор',
  manage: 'Керувати',
  profile: 'Профіль',
  assignCredits: 'Кредити',
  suspend: 'Призупинити',
  restore: 'Відновити',
  removeFromOffice: 'Видалити з офісу',
  suspendedTitle: 'Призупинені агенти',
  confirm: 'Підтвердити',
  cancel: 'Скасувати',
  goToCrm: 'Перейти до CRM',
  edit: 'Редагувати',
  partnerPlan: {
    ...en.partnerPlan,
    activePackage: 'Активний пакет',
    trialBadge: 'Пробний період',
    proTrialBadge: 'Пробний Partner Pro · 30 дн.',
    freePeriodBadge: 'Partner Free · 90 дн. · 0 zł',
    freePeriodNote: (periodDays) =>
      ` Стартовий період ${periodDays} дн. від реєстрації офісу — як на сторінці цін. Без картки, без абонементу.`,
    freePlanNote:
      ' Після закінчення можна обрати платний пакет — без автоматичних списань.',
    proTrialNote: (price, periodDays) =>
      ` Пробний Partner Pro (${periodDays} дн.) — після нього можна продовжити Pro (${price} zł / ${periodDays} дн.) або обрати інший пакет.`,
    paidRenewalNote: (price, periodDays) =>
      ` Абонемент поновлюється кожні ${periodDays} дн. (${price} zł) — керування в налаштуваннях облікового запису.`,
    upgradePackage: 'Покращити пакет',
    freeUpgradeNote:
      'У вас активний Partner Free. Оберіть платний пакет, коли потрібно більше кредитів або місць у команді.',
    trialCheckoutNote: (price, periodDays) =>
      `Платний Pro: ${price} zł / ${periodDays} дн. після пробного. Partner Free (90 дн.) активується при реєстрації офісу.`,
    recommended: 'Найчастіше обирають',
    perkOfficePro:
      'Уся команда отримує статус Pro: Off Market, Market, стрічки в каталозі та титанову панель',
    perkReports: '5 звітів оцінки на e-mail клієнтам — на особу / 30 днів',
    perkMarket: 'На кожній пропозиції видно, наскільки ціна відхиляється від нотаріальних угод',
    perkStartGap: 'Без Off Market, Market, стрічок і звітів — це переваги Partner Pro',
    trialCta: 'Розпочати пробний період',
    upgradeCta: 'Покращити пакет',
    activateCta: 'Активувати пакет',
    planLabels: {
      free: 'Partner Free',
      start: 'Partner Start',
      pro: 'Partner Pro',
      enterprise: 'Partner Enterprise',
    },
  },
};

const MAP: Record<Locale, AgencyFirmDictionary> = { pl, en, uk };

export function getAgencyFirm(locale: Locale): AgencyFirmDictionary {
  return MAP[locale] ?? pl;
}

export function formatAgencyDate(iso: string | null, locale: Locale): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(numberFormatLocale(locale), { dateStyle: 'long' });
}

export function formatAgencyDateTime(iso: string | null, locale: Locale): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(numberFormatLocale(locale), {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}
