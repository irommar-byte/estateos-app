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
    activePool: string;
    upgradePackage: string;
    validUntil: (date: string, days: string) => string;
    trialRenewalNote: (price: number) => string;
    freePlanNote: string;
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
    per30Days: string;
    creditsOnPool: (n: number) => string;
    agentsInTeam: (label: string) => string;
    whatChanges: (planName: string) => string;
    trialCheckoutNote: (price: number) => string;
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
    activePool: 'Aktywna pula kredytów firmy.',
    upgradePackage: 'Ulepsz pakiet',
    validUntil: (date, days) => `Ważne do ${date}${days}`,
    trialRenewalNote: (price) =>
      ` Po zakończeniu trialu kontynuujesz na planie Partner Pro (${price} zł / 30 dni) — zmiana lub rezygnacja w ustawieniach subskrypcji w każdej chwili.`,
    freePlanNote:
      ' Pakiet Partner Free — ulepsz plan, gdy zespół lub liczba publikacji urośnie.',
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
    recommended: 'Polecany',
    per30Days: 'zł / 30 dni',
    creditsOnPool: (n) => `${n} kredytów na pulę`,
    agentsInTeam: (label) => `${label} w zespole`,
    whatChanges: (planName) => `Co się zmieni — ${planName}`,
    trialCheckoutNote: (price) =>
      `30 dni na start bez opłaty za pakiet Pro. Potem ${price} zł / 30 dni — warunki widoczne przed potwierdzeniem płatności.`,
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
    activePool: 'Company credit pool is active.',
    upgradePackage: 'Upgrade plan',
    validUntil: (date, days) => `Valid until ${date}${days}`,
    trialRenewalNote: (price) =>
      ` After the trial you continue on Partner Pro (${price} PLN / 30 days) — change or cancel anytime in subscription settings.`,
    freePlanNote: ' Partner Free — upgrade when your team or listing volume grows.',
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
    recommended: 'Recommended',
    per30Days: 'PLN / 30 days',
    creditsOnPool: (n) => `${n} credits for the pool`,
    agentsInTeam: (label) => `${label} on the team`,
    whatChanges: (planName) => `What changes — ${planName}`,
    trialCheckoutNote: (price) =>
      `30 days to start with no Pro plan charge. Then ${price} PLN / 30 days — terms shown before payment confirmation.`,
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
    upgradePackage: 'Покращити пакет',
    trialCta: 'Розпочати пробний період',
    upgradeCta: 'Покращити пакет',
    activateCta: 'Активувати пакет',
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
