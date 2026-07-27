import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveWebUserId } from "@/lib/webSessionAuth";
import { buildEstateOsGuideContext } from "@/lib/estateOsGuideContext";
import { buildDiscoveryBuyerBrief } from "@/lib/discoveryInsights";
import { discoveryPropertyTypeLabel } from "@/lib/discovery/displayLabels";

export async function GET(req: Request) {
  try {
    const userId = await resolveWebUserId(req);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Zaloguj się, aby zobaczyć EstateOS™ Intelligence Pulse." },
        { status: 401 },
      );
    }

    const [profile, guide] = await Promise.all([
      prisma.discoveryProfile.findUnique({ where: { userId } }),
      buildEstateOsGuideContext(userId),
    ]);

    const brief = buildDiscoveryBuyerBrief({
      likesCount: profile?.likesCount || 0,
      dislikesCount: profile?.dislikesCount || 0,
      fastTrackCount: profile?.fastTrackCount || 0,
      opensCount: profile?.opensCount || 0,
      cityStats: profile?.cityStats,
      districtStats: profile?.districtStats,
      propertyStats: profile?.propertyStats,
      reasonStats: profile?.reasonStats,
    });

    const topCity = brief.topCities[0]?.key || null;
    const topTypeRaw = brief.topPropertyTypes[0]?.key || null;
    const topType = topTypeRaw ? discoveryPropertyTypeLabel(topTypeRaw) : null;
    const confidence = profile?.confidence ?? 0;
    const contradictionIndex = profile?.contradictionIndex ?? 0;
    const progress = Math.round(Math.min(1, Math.max(0, guide.stageProgress || 0)) * 100);

    const directionLine = [
      topCity,
      topType,
      brief.preferredBudgetPln ? `~${brief.preferredBudgetPln.toLocaleString("pl-PL")} PLN` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const suggestion =
      contradictionIndex >= 0.55
        ? "Sygnały się mieszają. Zrób 2-3 spokojne decyzje „Nie dla mnie” z powodem."
        : guide.nextStep?.title || "Kierunek się ostrzy. Kontynuuj spokojnie ocenianie ofert.";

    return NextResponse.json(
      {
        success: true,
        pulse: {
          stage: guide.intentStage,
          stageLabel: guide.intentLabel,
          progress,
          confidence,
          contradictionIndex,
          directionLine: directionLine || "Budujemy Twój kierunek z każdej decyzji.",
          summaryLine: guide.summaryLine,
          suggestion,
          decisionCount: guide.decisionCount,
          primaryCta: guide.primaryCta,
          secondaryCta: guide.secondaryCta,
          updatedAt: profile?.updatedAt?.toISOString() || null,
        },
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("[DISCOVERY PULSE ERROR]", error);
    return NextResponse.json({ success: false, error: "Błąd serwera" }, { status: 500 });
  }
}
