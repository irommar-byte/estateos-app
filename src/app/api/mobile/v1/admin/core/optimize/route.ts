export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

import { handleAdminCoreOptimizeGET, handleAdminCoreOptimizePOST } from '@/lib/adminCoreOpsHandlers';

export async function GET(req: Request) {
  return handleAdminCoreOptimizeGET(req);
}

export async function POST(req: Request) {
  return handleAdminCoreOptimizePOST(req);
}
