export type AdminReportStatus = 'PENDING' | 'IN_REVIEW' | 'ACTIONED' | 'DISMISSED';

/** Filtr listy admina (ARCHIVED = ACTIONED + DISMISSED). */
export type AdminReportListStatus = AdminReportStatus | 'ARCHIVED' | 'ALL';

export type AdminReportCategory =
  | 'SPAM'
  | 'SCAM'
  | 'HARASSMENT'
  | 'ILLEGAL_CONTENT'
  | 'MISLEADING_OFFER'
  | 'OTHER';

export type AdminReportPerson = {
  id: number;
  name: string | null;
  email: string | null;
  phone?: string | null;
};

export type AdminContentReport = {
  id: string;
  status: AdminReportStatus;
  category: AdminReportCategory;
  reason: string | null;
  adminNote: string | null;
  targetType: 'OFFER' | 'USER';
  targetId: string | null;
  createdAt: string;
  updatedAt: string;
  reporter: AdminReportPerson;
  reportedUser: AdminReportPerson | null;
  offer: {
    id: number;
    title: string | null;
    status: string | null;
    street: string | null;
    owner: { id: number | null; name: string | null; email: string | null };
  } | null;
};

export type AdminReportCounts = {
  pending: number;
  inReview: number;
  actioned: number;
  dismissed: number;
  total: number;
};

export const ADMIN_REPORT_CATEGORY_LABELS: Record<AdminReportCategory, string> = {
  SPAM: 'Spam lub reklama',
  SCAM: 'Oszustwo',
  HARASSMENT: 'Nękanie / obraźliwe',
  ILLEGAL_CONTENT: 'Niezgodne z prawem',
  MISLEADING_OFFER: 'Myląca oferta',
  OTHER: 'Inne',
};

export const ADMIN_REPORT_STATUS_LABELS: Record<AdminReportStatus, string> = {
  PENDING: 'Oczekuje',
  IN_REVIEW: 'W toku',
  ACTIONED: 'Podjęto działanie',
  DISMISSED: 'Odrzucone',
};
