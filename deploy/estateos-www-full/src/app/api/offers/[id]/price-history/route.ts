import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decryptSession } from "@/lib/sessionUtils";
import { prisma } from "@/lib/prisma";
import { fetchOfferPriceHistory } from "@/lib/offerPriceHistory";

async function resolveViewerPro(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionToken =
    cookieStore.get("estateos_session")?.value || cookieStore.get("luxestate_user")?.value || "";
  if (!sessionToken) return false;
  try {
    const sessionData = decryptSession(sessionToken) as { email?: string } | null;
    const email = sessionData?.email ? String(sessionData.email).trim().toLowerCase() : "";
    if (!email) return false;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return false;
    const proExpiresAt = user.proExpiresAt ? new Date(user.proExpiresAt) : null;
    return Boolean(
      user.role === "ADMIN" || (user.isPro && (!proExpiresAt || proExpiresAt.getTime() > Date.now())),
    );
  } catch {
    return false;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offerId = Number(id);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ error: "Invalid offer id" }, { status: 400 });
  }

  const isPro = await resolveViewerPro();
  if (!isPro) {
    return NextResponse.json({ error: "Investor Pro required" }, { status: 403 });
  }

  const history = await fetchOfferPriceHistory(offerId);
  return NextResponse.json({
    success: true,
    history: history.map((row) => ({
      ...row,
      recordedAt: row.recordedAt.toISOString(),
    })),
  });
}
