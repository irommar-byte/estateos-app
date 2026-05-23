export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { handleAdminCoreMetricsGET } from '@/lib/adminCoreMetrics';

/** Alias dla starszych klientów — kanoniczny: GET /api/mobile/v1/admin/core/metrics */
export async function GET(req: Request) {
  return handleAdminCoreMetricsGET(req);
}
