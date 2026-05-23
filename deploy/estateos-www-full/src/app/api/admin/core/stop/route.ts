export const dynamic = "force-dynamic";
export const revalidate = 0;

import { handleAdminCoreControlPOST } from "@/lib/adminCoreControl";

/** Alias: POST /api/admin/core/stop */
export async function POST(req: Request) {
  return handleAdminCoreControlPOST(req, "stop");
}
