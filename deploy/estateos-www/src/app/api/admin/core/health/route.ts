export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { handleAdminCoreHealthGET } from '@/lib/adminCoreMetrics';

/** Alias — kanoniczny: GET /api/mobile/v1/admin/core/health */
export async function GET(req: Request) {
  return handleAdminCoreHealthGET(req);
}
