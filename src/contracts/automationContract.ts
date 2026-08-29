import type { KeiAutoImportConfig, KeiImportJobSnapshot } from './keiAmerContract';

export type ScheduledJobView = {
  id: string;
  name: string;
  schedule: string;
  scheduleLabel: string;
  description: string;
  pm2Status: string | null;
  pm2Uptime: string | null;
  pm2Restarts: number | null;
  nextHint: string | null;
};

export type ImportRegistryRow = {
  offerId: number;
  offerTitle: string;
  offerStatus: string;
  offerCreatedAt: string;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  importSource: string;
  importExternalUrl: string | null;
  importExternalId: string | null;
  importedAt: string | null;
  sourceIsActive: boolean | null;
  sourceLastCheckAt: string | null;
  smartAddFields: string[];
  smartAddSummary: string | null;
  keiId: string | null;
};

export type AutomationOverview = {
  scheduled: ScheduledJobView[];
  keiAuto: KeiAutoImportConfig | null;
  activeJobs: KeiImportJobSnapshot[];
  recentJobs: KeiImportJobSnapshot[];
  recentJobsTotal: number;
  imports: ImportRegistryRow[];
  importsTotal: number;
  generatedAt: string;
};
