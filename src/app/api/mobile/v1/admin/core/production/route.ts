export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { handleAdminCoreProductionGET } from '@/lib/adminCoreOpsHandlers';

export async function GET(req: Request) {
  return handleAdminCoreProductionGET(req);
}
