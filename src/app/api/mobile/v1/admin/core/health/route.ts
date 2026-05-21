export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { handleAdminCoreHealthGET } from '@/lib/adminCoreMetrics';

export async function GET(req: Request) {
  return handleAdminCoreHealthGET(req);
}
