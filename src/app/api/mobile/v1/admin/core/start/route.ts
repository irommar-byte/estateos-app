export const dynamic = "force-dynamic";
export const revalidate = 0;

import { handleAdminCoreControlPOST } from "@/lib/adminCoreControl";

/** Kanoniczny: POST /api/mobile/v1/admin/core/start */
export async function POST(req: Request) {
  return handleAdminCoreControlPOST(req, "start");
}
