export const dynamic = "force-dynamic";
export const revalidate = 0;

import { handleAdminCoreLogsGET } from "@/lib/adminCoreLogs";

export async function GET(req: Request) {
  return handleAdminCoreLogsGET(req);
}
