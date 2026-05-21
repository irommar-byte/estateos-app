export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { handleAdminCoreMetricsGET } from '@/lib/adminCoreMetrics';

export async function GET(req: Request) {
  return handleAdminCoreMetricsGET(req);
}
