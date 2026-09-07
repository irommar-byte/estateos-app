export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { handleAdminCoreProcessesGET, handleAdminCoreProcessesPOST } from '@/lib/adminCoreOpsHandlers';

export async function GET(req: Request) {
  return handleAdminCoreProcessesGET(req);
}

export async function POST(req: Request) {
  return handleAdminCoreProcessesPOST(req);
}
