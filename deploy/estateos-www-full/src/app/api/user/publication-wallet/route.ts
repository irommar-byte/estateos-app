import { NextResponse } from "next/server";
import { resolveWebUserId } from "@/lib/webSessionAuth";
import { getPublicationWallet } from "@/lib/publicationWallet";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const locale = searchParams.get("locale") === "en" ? "en" : "pl";

  try {
    const wallet = await getPublicationWallet(userId, locale);
    return NextResponse.json({ success: true, ...wallet });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
