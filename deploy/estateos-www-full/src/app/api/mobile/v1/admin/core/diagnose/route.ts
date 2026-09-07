export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { handleAdminCoreDiagnoseGET } from '@/lib/adminCoreOpsHandlers';

export async function GET(req: Request) {
  return handleAdminCoreDiagnoseGET(req);
}
