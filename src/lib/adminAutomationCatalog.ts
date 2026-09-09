export type AutomationCronJob = {
  id: string;
  name: string;
  schedule: string;
  scheduleLabel: string;
  description: string;
  script: string;
};

/** Katalog zadań PM2 cron — zsynchronizowany z ecosystem.config.cjs */
export const AUTOMATION_CRON_CATALOG: AutomationCronJob[] = [
  {
    id: 'kei-import-worker',
    name: 'KEI import worker',
    schedule: 'ciągły',
    scheduleLabel: 'Jeden trwały worker',
    description: 'Kolejka i import KEI poza procesem HTTP, concurrency 1, lease w bazie.',
    script: 'scripts/kei-import-worker.ts',
  },
  {
    id: 'client-intelligence',
    name: 'Inteligencja CRM',
    schedule: '12 * * * *',
    scheduleLabel: 'Co godzinę o :12',
    description: 'Cykl asystenta dopasowań klientów CRM.',
    script: 'scripts/client-intelligence.cjs',
  },
  {
    id: 'seller-marketing-renewals',
    name: 'Odnowienia publikacji sprzedających',
    schedule: '25 9 * * *',
    scheduleLabel: 'Codziennie o 09:25',
    description: 'Przypomnienia dla agentów o wygasających publikacjach zewnętrznych.',
    script: 'scripts/seller-marketing-renewals.cjs',
  },
  {
    id: 'reviews-finalization-fallback',
    name: 'Finalizacja opinii',
    schedule: '0 * * * *',
    scheduleLabel: 'Co godzinę o :00',
    description: 'Automatyczne zamykanie transakcji po 14 dniach bez reakcji.',
    script: 'scripts/reviews-finalization-fallback.cjs',
  },
  {
    id: 'partner-growth-nurture',
    name: 'Partner growth',
    schedule: '0 8 * * *',
    scheduleLabel: 'Codziennie o 08:00',
    description: 'Maile nurture dla partnerów.',
    script: 'scripts/partner-growth-nurture.ts',
  },
  {
    id: 'rcn-market-ingest',
    name: 'RCN rynek Warszawa',
    schedule: '20 3 * * 0',
    scheduleLabel: 'Niedziela o 03:20',
    description: 'Import danych rynkowych RCN.',
    script: 'scripts/ingest-rcn-market.ts',
  },
];
