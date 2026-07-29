import { NextResponse } from "next/server";
import { resolveWebUserId } from "@/lib/webSessionAuth";
import { buildEstateOsGuideContext } from "@/lib/estateOsGuideContext";

export async function GET(req: Request) {
  try {
    const userId = await resolveWebUserId(req);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Zaloguj się, aby zobaczyć EstateOS™ Intelligence Pulse." },
        { status: 401 },
      );
    }

    const guide = await buildEstateOsGuideContext(userId);
    const confidence = guide.confidence ?? 0;
    const contradictionIndex = guide.contradictionIndex ?? 0;
    const progress = Math.round(Math.min(1, Math.max(0, guide.stageProgress || 0)) * 100);

    const normalizedSummary = String(guide.summaryLine || "").trim();
    const directionLine =
      normalizedSummary && !normalizedSummary.includes("Za mało")
        ? normalizedSummary
        : "Budujemy Twój kierunek z każdej decyzji.";

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
          updatedAt: guide.profileUpdatedAt?.toISOString() || null,
        },
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("[DISCOVERY PULSE ERROR]", error);
    return NextResponse.json({ success: false, error: "Błąd serwera" }, { status: 500 });
  }
}
